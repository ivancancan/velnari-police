// apps/api/src/modules/patrols/patrols.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PatrolsService } from './patrols.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole, CreatePatrolDto } from '@velnari/shared-types';
import type { PatrolEntity } from '../../entities/patrol.entity';
import type { Request } from 'express';

@Controller('patrols')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PatrolsController {
  constructor(private readonly service: PatrolsService) {}

  @Get()
  findActive(): Promise<PatrolEntity[]> {
    return this.service.findActive();
  }

  @Get('unit/:unitId')
  findByUnit(@Param('unitId', ParseUUIDPipe) unitId: string): Promise<PatrolEntity[]> {
    return this.service.findByUnit(unitId);
  }

  @Get(':id/coverage')
  getCoverage(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getCoverage(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.COMMANDER, UserRole.OPERATOR)
  create(
    @Body() dto: CreatePatrolDto,
    @Req() req: Request & { user: { sub: string } },
  ): Promise<PatrolEntity> {
    return this.service.create(dto, req.user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.COMMANDER, UserRole.OPERATOR)
  async cancel(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.service.cancel(id);
  }
}
