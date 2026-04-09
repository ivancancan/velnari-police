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
import { IncidentsService, PatrolReport } from '../incidents/incidents.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole, CreatePatrolDto } from '@velnari/shared-types';
import type { PatrolEntity } from '../../entities/patrol.entity';
import type { Request } from 'express';

@Controller('patrols')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PatrolsController {
  constructor(
    private readonly service: PatrolsService,
    private readonly incidentsService: IncidentsService,
  ) {}

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

  @Post(':id/accept')
  @Roles(UserRole.ADMIN, UserRole.FIELD_UNIT, UserRole.OPERATOR, UserRole.SUPERVISOR)
  accept(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user: { sub: string } },
  ): Promise<PatrolEntity> {
    return this.service.accept(id, req.user.sub);
  }

  @Get('unit/:unitId/active')
  getActiveForUnit(@Param('unitId', ParseUUIDPipe) unitId: string): Promise<PatrolEntity | null> {
    return this.service.getActivePatrolForUnit(unitId);
  }

  @Get(':id/report')
  getReport(@Param('id', ParseUUIDPipe) id: string): Promise<PatrolReport> {
    return this.incidentsService.getPatrolReport(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.COMMANDER, UserRole.OPERATOR)
  async cancel(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.service.cancel(id);
  }
}
