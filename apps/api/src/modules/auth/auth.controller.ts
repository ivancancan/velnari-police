import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CurrentUser, type JwtPayload } from '../../shared/decorators/current-user.decorator';
import { RedisCacheService } from '../../shared/services/redis-cache.service';
import { LoginDto, type TokenResponseDto } from '@velnari/shared-types';
import type { UserEntity } from '../../entities/user.entity';
import type { Request } from 'express';

@ApiTags('auth')
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
  @ApiOperation({ summary: 'Iniciar sesión y obtener tokens JWT' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login exitoso — devuelve accessToken, refreshToken, expiresIn' })
  @ApiResponse({ status: 401, description: 'Credenciales incorrectas' })
  @ApiResponse({ status: 423, description: 'Cuenta bloqueada por intentos fallidos' })
  async login(@Body() dto: LoginDto): Promise<TokenResponseDto> {
    const MAX_FAILS = 10;
    const LOCK_WINDOW_SECONDS = 900; // 15 min rolling window

    // Check lockout BEFORE touching the DB — prevents timing attacks to enumerate emails.
    const failCount = await this.redis.getLoginFailCount(dto.email);
    if (failCount >= MAX_FAILS) {
      // 423 Locked
      throw new HttpException(
        'Cuenta bloqueada temporalmente por múltiples intentos fallidos. Intenta de nuevo en 15 minutos.',
        423,
      );
    }

    const user = await this.authService.validateUser(dto.email, dto.password);
    if (!user) {
      await this.redis.incrementLoginFail(dto.email, LOCK_WINDOW_SECONDS);
      throw new UnauthorizedException('Credenciales incorrectas.');
    }
    await this.redis.resetLoginFails(dto.email);
    return this.authService.login(user);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renovar access token usando refresh token' })
  @ApiResponse({ status: 200, description: 'Nuevo accessToken' })
  @ApiResponse({ status: 401, description: 'Refresh token inválido o expirado' })
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
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Perfil del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Usuario autenticado' })
  async me(@CurrentUser() user: JwtPayload): Promise<UserEntity | null> {
    return this.authService.getProfile(user.sub);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Cerrar sesión e invalidar access token' })
  @ApiResponse({ status: 204, description: 'Sesión cerrada' })
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
