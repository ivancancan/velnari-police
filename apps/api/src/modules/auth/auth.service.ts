import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UserEntity } from '../../entities/user.entity';
import type { TokenResponseDto } from '@velnari/shared-types';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async validateUser(email: string, password: string): Promise<UserEntity | null> {
    const user = await this.userRepo.findOne({ where: { email } });

    if (!user || !user.isActive) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  async login(user: UserEntity): Promise<TokenResponseDto> {
    const payload = { sub: user.id, email: user.email, role: user.role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('jwt.secret'),
        expiresIn: this.config.get<string>('jwt.expiresIn'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('jwt.refreshSecret'),
        expiresIn: this.config.get<string>('jwt.refreshExpiresIn'),
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
    };
  }

  async getProfile(userId: string): Promise<UserEntity | null> {
    return this.userRepo.findOne({ where: { id: userId } });
  }

  async refreshToken(
    userId: string,
    role: string,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }

    const payload = { sub: userId, email: user.email, role };
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.config.get<string>('jwt.secret'),
      expiresIn: this.config.get<string>('jwt.expiresIn'),
    });

    return { accessToken, expiresIn: 900 };
  }
}
