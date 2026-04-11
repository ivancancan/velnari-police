import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '@velnari/shared-types';
import type { MunicipioEntity } from '../../entities/municipio.entity';

@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantsController {
  constructor(private readonly service: TenantsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  findAll(): Promise<MunicipioEntity[]> {
    return this.service.findAll();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<MunicipioEntity> {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(
    @Body() dto: { name: string; state?: string; slug?: string; contactEmail?: string },
  ): Promise<MunicipioEntity> {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { name?: string; state?: string; contactEmail?: string; isActive?: boolean },
  ): Promise<MunicipioEntity> {
    return this.service.update(id, dto);
  }
}
