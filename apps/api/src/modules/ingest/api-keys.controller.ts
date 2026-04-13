import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiKeysService } from './api-keys.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentUser, type JwtPayload } from '../../shared/decorators/current-user.decorator';
import { UserRole } from '@velnari/shared-types';

@ApiTags('api-keys')
@Controller('api-keys')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('access-token')
export class ApiKeysController {
  constructor(private readonly service: ApiKeysService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Listar API keys activas' })
  async list(@CurrentUser() user: JwtPayload) {
    const keys = await this.service.list(user.tenantId ?? null);
    return keys.map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.prefix,
      scopes: k.scopes,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt,
      useCount: k.useCount,
      isActive: k.isActive,
    }));
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Crear API key — la raw key se devuelve UNA sola vez' })
  @ApiResponse({ status: 201, description: '{ id, name, prefix, rawKey }' })
  async create(
    @Body() body: { name: string; scopes?: string[] },
    @CurrentUser() user: JwtPayload,
  ) {
    const { apiKey, rawKey } = await this.service.create({
      name: body.name,
      createdBy: user.sub,
      scopes: body.scopes,
      tenantId: user.tenantId ?? null,
    });
    return {
      id: apiKey.id,
      name: apiKey.name,
      prefix: apiKey.prefix,
      scopes: apiKey.scopes,
      createdAt: apiKey.createdAt,
      rawKey, // ONCE
    };
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Revocar (soft-delete) una API key' })
  async revoke(@Param('id') id: string): Promise<{ ok: true }> {
    await this.service.revoke(id);
    return { ok: true };
  }
}
