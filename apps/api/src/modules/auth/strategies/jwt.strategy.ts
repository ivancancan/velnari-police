import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import type { JwtPayload } from '../../../shared/decorators/current-user.decorator';
import { RedisCacheService } from '../../../shared/services/redis-cache.service';
import type { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly redis: RedisCacheService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.secret') ?? '',
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload): Promise<JwtPayload> {
    if (!payload.sub || !payload.role) {
      throw new UnauthorizedException();
    }

    // Check token blacklist (logout)
    const token = (req.headers.authorization ?? '').replace('Bearer ', '');
    if (token) {
      const jti = createHash('sha256').update(token).digest('hex').slice(0, 32);
      const blacklisted = await this.redis.isTokenBlacklisted(jti);
      if (blacklisted) {
        throw new UnauthorizedException('Token revocado.');
      }
    }

    return payload;
  }
}
