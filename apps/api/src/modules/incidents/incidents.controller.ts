import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}
import { IncidentsService } from './incidents.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import type { JwtPayload } from '../../shared/decorators/current-user.decorator';
import {
  UserRole,
  IncidentStatus,
  CreateIncidentDto,
  CloseIncidentDto,
  AddIncidentNoteDto,
} from '@velnari/shared-types';
import type { IncidentEntity } from '../../entities/incident.entity';
import type { IncidentEventEntity } from '../../entities/incident-event.entity';

@Controller('incidents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IncidentsController {
  constructor(private readonly service: IncidentsService) {}

  @Get()
  findAll(
    @Query('status') status?: IncidentStatus,
    @Query('sectorId') sectorId?: string,
    @Query('priority') priority?: string,
  ): Promise<IncidentEntity[]> {
    return this.service.findAll({ status, sectorId, priority });
  }

  @Get('stats')
  getStats(@Query('date') date?: string): Promise<{
    total: number;
    open: number;
    assigned: number;
    closed: number;
    byPriority: Record<string, number>;
    byType: Record<string, number>;
    avgResponseMinutes: number | null;
  }> {
    const d = date && !isNaN(Date.parse(date)) ? new Date(date) : new Date();
    return this.service.getStats(d);
  }

  @Get('heatmap')
  getHeatmap(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<{ lat: number; lng: number; weight: number }[]> {
    const now = new Date();
    const fromDate = from && !isNaN(Date.parse(from)) ? new Date(from) : startOfDay(now);
    const toDate = to && !isNaN(Date.parse(to)) ? new Date(to) : endOfDay(now);
    return this.service.getHeatmapPoints(fromDate, toDate);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<IncidentEntity> {
    return this.service.findOne(id);
  }

  @Get(':id/events')
  getEvents(@Param('id', ParseUUIDPipe) id: string): Promise<IncidentEventEntity[]> {
    return this.service.getEvents(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.SUPERVISOR)
  create(
    @Body() dto: CreateIncidentDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<IncidentEntity> {
    return this.service.create(dto, user.sub);
  }

  @Post(':id/close')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.FIELD_UNIT)
  close(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloseIncidentDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<IncidentEntity> {
    return this.service.close(id, dto, user.sub);
  }

  @Post(':id/notes')
  addNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddIncidentNoteDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<IncidentEventEntity> {
    return this.service.addNote(id, dto, user.sub);
  }
}
