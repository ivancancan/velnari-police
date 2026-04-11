import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CurrentUser, type JwtPayload } from '../../shared/decorators/current-user.decorator';
import { RedisCacheService } from '../../shared/services/redis-cache.service';
import { LoginDto, type TokenResponseDto } from '@velnari/shared-types';
import type { UserEntity } from '../../entities/user.entity';
import type { Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redis: RedisCacheService,
  ) {}

  @Post('login')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto): Promise<TokenResponseDto> {
    const user = await this.authService.validateUser(dto.email, dto.password);
    if (!user) {
      throw new UnauthorizedException('Credenciales incorrectas.');
    }
    return this.authService.login(user);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body('refreshToken') refreshToken: string,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token requerido.');
    }

    let payload: { sub: string; role: string };
    try {
      payload = this.jwtService.verify<{ sub: string; role: string }>(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret') ?? '',
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado.');
    }

    return this.authService.refreshToken(payload.sub, payload.role);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: JwtPayload): Promise<UserEntity | null> {
    return this.authService.getProfile(user.sub);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request): Promise<void> {
    const token = (req.headers.authorization ?? '').replace('Bearer ', '');
    if (!token) return;
    const jti = createHash('sha256').update(token).digest('hex').slice(0, 32);
    // Blacklist for 15 minutes (access token lifetime)
    await this.redis.blacklistToken(jti, 900);
  }

  @Patch('push-token')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async updatePushToken(
    @CurrentUser() user: JwtPayload,
    @Body('token') token: string,
  ): Promise<void> {
    if (!token || typeof token !== 'string') return;
    await this.authService.updatePushToken(user.sub, token);
  }
}
