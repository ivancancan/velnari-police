import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CurrentUser, type JwtPayload } from '../../shared/decorators/current-user.decorator';
import { LoginDto, type TokenResponseDto } from '@velnari/shared-types';
import type { UserEntity } from '../../entities/user.entity';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
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
