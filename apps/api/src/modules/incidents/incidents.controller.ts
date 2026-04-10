import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  forwardRef,
} from '@nestjs/common';

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}
import { IncidentsService, DailySummary, ShiftHandoff, AnalyticsResult, PatrolReport } from './incidents.service';
import { DispatchService } from '../dispatch/dispatch.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import type { JwtPayload } from '../../shared/decorators/current-user.decorator';
import {
  UserRole,
  IncidentStatus,
  CreateIncidentDto,
  UpdateIncidentDto,
  CloseIncidentDto,
  AddIncidentNoteDto,
} from '@velnari/shared-types';
import type { IncidentEntity } from '../../entities/incident.entity';
import type { IncidentEventEntity } from '../../entities/incident-event.entity';
import type { IncidentUnitAssignmentEntity } from '../../entities/incident-unit-assignment.entity';

@Controller('incidents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IncidentsController {
  constructor(
    private readonly service: IncidentsService,
    @Inject(forwardRef(() => DispatchService))
    private readonly dispatchService: DispatchService,
  ) {}

  @Get()
  findAll(
    @Query('status') status?: IncidentStatus,
    @Query('sectorId') sectorId?: string,
    @Query('priority') priority?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<IncidentEntity[]> {
    return this.service.findAll({
      status,
      sectorId,
      priority,
      limit: parseInt(limit as string) || 50,
      offset: parseInt(offset as string) || 0,
    });
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

  @Get('daily-summary')
  getDailySummary(@Query('date') date?: string): Promise<DailySummary> {
    const d = date && !isNaN(Date.parse(date)) ? new Date(date) : new Date();
    return this.service.getDailySummary(d);
  }

  @Get('shift-handoff')
  getShiftHandoff(): Promise<ShiftHandoff> {
    return this.service.getShiftHandoff();
  }

  @Get('analytics')
  getAnalytics(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('unitId') unitId?: string,
    @Query('sectorId') sectorId?: string,
    @Query('patrolId') patrolId?: string,
    @Query('userId') userId?: string,
  ): Promise<AnalyticsResult> {
    const now = new Date();
    const fromDate = from && !isNaN(Date.parse(from)) ? new Date(from) : startOfDay(now);
    const toDate = to && !isNaN(Date.parse(to)) ? new Date(to) : endOfDay(now);
    return this.service.getAnalytics({
      from: fromDate,
      to: toDate,
      unitId: unitId || undefined,
      sectorId: sectorId || undefined,
      patrolId: patrolId || undefined,
      userId: userId || undefined,
    });
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

  @Get('sla-compliance')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.COMMANDER, UserRole.OPERATOR)
  getSlaCompliance(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const now = new Date();
    const fromDate = from && !isNaN(Date.parse(from)) ? new Date(from) : startOfDay(now);
    const toDate = to && !isNaN(Date.parse(to)) ? new Date(to) : endOfDay(now);
    return this.service.getSlaCompliance(fromDate, toDate);
  }

  @Get('trends')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.COMMANDER)
  getTrends(@Query('weeks') weeks?: string) {
    return this.service.getTrends(weeks ? parseInt(weeks) : 4);
  }

  @Get('anomalies')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.COMMANDER)
  getAnomalies() {
    return this.service.getAnomalies();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<IncidentEntity> {
    return this.service.findOne(id);
  }

  @Get(':id/events')
  getEvents(@Param('id', ParseUUIDPipe) id: string): Promise<IncidentEventEntity[]> {
    return this.service.getEvents(id);
  }

  @Get(':id/assignments')
  getAssignments(@Param('id', ParseUUIDPipe) id: string): Promise<IncidentUnitAssignmentEntity[]> {
    return this.service.getAssignments(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.SUPERVISOR)
  create(
    @Body() dto: CreateIncidentDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<IncidentEntity> {
    return this.service.create(dto, user.sub);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.SUPERVISOR)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIncidentDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<IncidentEntity> {
    return this.service.update(id, dto, user.sub);
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

  @Post(':id/reassign')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.COMMANDER)
  reassign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { unitId: string },
    @CurrentUser() user: JwtPayload,
  ): Promise<IncidentEntity> {
    return this.dispatchService.reassignUnit(id, body.unitId, user.sub);
  }

  @Post(':id/merge')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.SUPERVISOR)
  merge(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { targetIncidentId: string },
    @CurrentUser() user: JwtPayload,
  ): Promise<IncidentEntity> {
    return this.service.merge(id, body.targetIncidentId, user.sub);
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
