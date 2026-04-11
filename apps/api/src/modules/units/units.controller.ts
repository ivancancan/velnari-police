import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import type { JwtPayload } from '../../shared/decorators/current-user.decorator';
import { UnitsService } from './units.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import {
  UserRole,
  UnitStatus,
  CreateUnitDto,
  UpdateUnitDto,
  UpdateUnitStatusDto,
  UnitLocationDto,
} from '@velnari/shared-types';
import type { UnitEntity } from '../../entities/unit.entity';
import type { UnitLocationHistoryEntity } from '../../entities/unit-location-history.entity';
import type { IncidentEntity } from '../../entities/incident.entity';
import { RealtimeGateway } from '../realtime/realtime.gateway';

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

@Controller('units')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UnitsController {
  constructor(
    private readonly service: UnitsService,
    private readonly realtime: RealtimeGateway,
  ) {}

  @Get()
  findAll(
    @Query('status') status?: UnitStatus,
    @Query('sectorId') sectorId?: string,
    @Query('shift') shift?: string,
    @CurrentUser() user?: JwtPayload,
  ): Promise<UnitEntity[]> {
    return this.service.findAll({ status, sectorId, shift, tenantId: user?.tenantId ?? null });
  }

  @Get('nearby')
  findNearby(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radiusKm') radiusKm?: string,
  ) {
    return this.service.findAvailableNearby({
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      radiusKm: radiusKm ? parseFloat(radiusKm) : undefined,
    });
  }

  @Get('stats')
  getStats(): Promise<{
    total: number;
    available: number;
    enRoute: number;
    onScene: number;
    outOfService: number;
  }> {
    return this.service.getStats();
  }

  @Get('scoreboard')
  @Roles(UserRole.ADMIN, UserRole.COMMANDER, UserRole.SUPERVISOR)
  getScoreboard() {
    return this.service.getScoreboard();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<UnitEntity> {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.COMMANDER, UserRole.SUPERVISOR)
  create(@Body() dto: CreateUnitDto): Promise<UnitEntity> {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.COMMANDER)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUnitDto,
  ): Promise<UnitEntity> {
    return this.service.update(id, dto);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.FIELD_UNIT)
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUnitStatusDto,
  ): Promise<UnitEntity> {
    return this.service.updateStatus(id, dto.status);
  }

  @Patch(':id/location')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.ADMIN, UserRole.FIELD_UNIT, UserRole.SUPERVISOR)
  async updateLocation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UnitLocationDto,
  ): Promise<void> {
    await this.service.updateLocation(id, dto.lat, dto.lng);
    const unit = await this.service.findOne(id);
    this.realtime.emitUnitLocationChanged(unit.sectorId ?? undefined, {
      unitId: id,
      lat: dto.lat,
      lng: dto.lng,
      timestamp: new Date().toISOString(),
      ...(dto.batteryLevel != null ? { batteryLevel: dto.batteryLevel } : {}),
    });
  }

  @Get(':id/report')
  @Roles(UserRole.ADMIN, UserRole.COMMANDER, UserRole.SUPERVISOR)
  getReport(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const fromDate = from && !isNaN(Date.parse(from)) ? new Date(from) : startOfDay(new Date());
    const toDate = to && !isNaN(Date.parse(to)) ? new Date(to) : endOfDay(new Date());
    return this.service.getUnitReport(id, fromDate, toDate);
  }

  @Get(':id/history')
  getHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<UnitLocationHistoryEntity[]> {
    const fromDate = from && !isNaN(Date.parse(from)) ? new Date(from) : startOfDay(new Date());
    const toDate = to && !isNaN(Date.parse(to)) ? new Date(to) : endOfDay(new Date());
    return this.service.getHistory(id, fromDate, toDate);
  }

  @Get(':id/incidents')
  getIncidentsByUnit(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<IncidentEntity[]> {
    const fromDate = from && !isNaN(Date.parse(from)) ? new Date(from) : startOfDay(new Date());
    const toDate = to && !isNaN(Date.parse(to)) ? new Date(to) : endOfDay(new Date());
    return this.service.getIncidentsByUnit(id, fromDate, toDate);
  }
}
