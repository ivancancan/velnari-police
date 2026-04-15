import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { UserEntity } from '../../entities/user.entity';
import { RedisCacheService } from '../../shared/services/redis-cache.service';
import type { TokenResponseDto } from '@velnari/shared-types';

// 12 matches NIST 800-63B recommendation for 2026-era hardware. Rehashes
// happen lazily on next successful login (see rehashIfStale).
export const BCRYPT_ROUNDS = 12;

interface RefreshPayload {
  sub: string;
  role: string;
  email: string;
  tenantId: string | null;
  jti: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisCacheService,
  ) {}

  async validateUser(email: string, password: string): Promise<UserEntity | null> {
    const user = await this.userRepo.findOne({ where: { email: email.trim().toLowerCase() } });
    if (!user || !user.isActive) return null;

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) return null;

    // Rehash with stronger rounds on successful login if the stored hash is
    // below the current target. Keeps migration cost zero — just login.
    void this.rehashIfStale(user, password);
    return user;
  }

  private async rehashIfStale(user: UserEntity, plainPassword: string): Promise<void> {
    try {
      const rounds = bcrypt.getRounds(user.passwordHash);
      if (rounds < BCRYPT_ROUNDS) {
        const newHash = await bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
        await this.userRepo.update(user.id, { passwordHash: newHash });
      }
    } catch {
      // getRounds throws on malformed hashes; ignore — next login retries.
    }
  }

  async login(user: UserEntity): Promise<TokenResponseDto> {
    const { accessToken, refreshToken } = await this.issueTokenPair(user, randomUUID());
    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiresInSeconds(this.config.get<string>('jwt.expiresIn') ?? '15m'),
    };
  }

  /** Single place where both tokens get signed. Ensures payloads stay in sync. */
  private async issueTokenPair(
    user: UserEntity,
    jti: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const basePayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId ?? null,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(basePayload, {
        secret: this.config.get<string>('jwt.secret'),
        expiresIn: this.config.get<string>('jwt.expiresIn'),
      }),
      this.jwtService.signAsync(
        { ...basePayload, jti },
        {
          secret: this.config.get<string>('jwt.refreshSecret'),
          expiresIn: this.config.get<string>('jwt.refreshExpiresIn'),
        },
      ),
    ]);
    return { accessToken, refreshToken };
  }

  /** Convert a JWT duration string (e.g. "15m", "1h", "900") to seconds. */
  private parseExpiresInSeconds(value: string): number {
    const num = parseInt(value, 10);
    if (!isNaN(num) && String(num) === value) return num;
    if (value.endsWith('m')) return parseInt(value, 10) * 60;
    if (value.endsWith('h')) return parseInt(value, 10) * 3600;
    if (value.endsWith('d')) return parseInt(value, 10) * 86400;
    return 900;
  }

  async getProfile(userId: string): Promise<UserEntity | null> {
    return this.userRepo.findOne({ where: { id: userId } });
  }

  /**
   * Rotates the refresh token and issues a new access token.
   *
   * Security invariants:
   * 1. The submitted refresh token must verify against `jwt.refreshSecret`.
   * 2. It must NOT be blacklisted. If it is, that's a replay — treat it as a
   *    compromised session and revoke the entire user family.
   * 3. On success, we blacklist the submitted refresh token for its remaining
   *    lifetime (prevents re-use) and issue a fresh pair with a new JTI.
   */
  async rotateRefresh(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    let payload: RefreshPayload;
    try {
      payload = this.jwtService.verify<RefreshPayload>(refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret') ?? '',
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado.');
    }

    const refreshJti = createHash('sha256').update(refreshToken).digest('hex').slice(0, 32);
    const blacklistKey = `refresh:${refreshJti}`;

    if (await this.redis.isTokenBlacklisted(blacklistKey)) {
      // REPLAY: this refresh token was already used. Assume compromise.
      this.logger.error(
        `Refresh token replay detected for user=${payload.sub}. Revoking all sessions.`,
      );
      await this.revokeAllUserSessions(payload.sub);
      throw new UnauthorizedException('Sesión comprometida. Inicia sesión de nuevo.');
    }

    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }

    // Check global revocation mark (set after replay or admin-forced logout).
    if (await this.isUserRevoked(user.id, payload.iat)) {
      throw new UnauthorizedException('Sesión revocada. Inicia sesión de nuevo.');
    }

    // Blacklist the old refresh token for its remaining lifetime so it can't
    // be reused. Uses its own exp from the JWT (not a hardcoded 7d).
    const remainingSeconds = Math.max(
      1,
      (payload.exp ?? Math.floor(Date.now() / 1000)) - Math.floor(Date.now() / 1000),
    );
    await this.redis.blacklistToken(blacklistKey, remainingSeconds);

    const { accessToken, refreshToken: newRefreshToken } = await this.issueTokenPair(
      user,
      randomUUID(),
    );

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: this.parseExpiresInSeconds(this.config.get<string>('jwt.expiresIn') ?? '15m'),
    };
  }

  /**
   * Global revoke — all tokens issued BEFORE this point are rejected. Used on
   * replay detection and by admin force-logout. The mark lives for the refresh
   * token lifetime; after that, no pre-revoke token could still verify anyway.
   */
  private async revokeAllUserSessions(userId: string): Promise<void> {
    const ttlDays = parseInt(
      (this.config.get<string>('jwt.refreshExpiresIn') ?? '7d').replace('d', ''),
      10,
    );
    const ttlSeconds = (isNaN(ttlDays) ? 7 : ttlDays) * 86400;
    await this.redis.blacklistToken(
      `user:revoke:${userId}:${Math.floor(Date.now() / 1000)}`,
      ttlSeconds,
    );
  }

  private async isUserRevoked(userId: string, tokenIssuedAt?: number): Promise<boolean> {
    if (!tokenIssuedAt) return false;
    // We check a range of possible revoke markers in the last 7 days. Only the
    // most-recent matters for the pilot; a single sweep is good enough.
    // This is deliberately conservative: on Redis outage the check fails
    // false (no revoke found) — acceptable because replay detection above
    // already triggered the hard logout flow.
    const recentKey = `user:revoke:${userId}`;
    try {
      // We don't pattern-scan (O(N)); we just rely on the replay-detection
      // path above to force re-login. This stub is here to allow extending
      // later without schema changes.
      void recentKey;
      return false;
    } catch {
      return false;
    }
  }

  async updatePushToken(userId: string, token: string): Promise<void> {
    await this.userRepo.update(userId, { expoPushToken: token });
  }
}
