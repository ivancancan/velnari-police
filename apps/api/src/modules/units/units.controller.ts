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
import { UnitsService } from './units.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import {
  UserRole,
  UnitStatus,
  type CreateUnitDto,
  type UpdateUnitStatusDto,
  type UnitLocationDto,
} from '@velnari/shared-types';
import type { UnitEntity } from '../../entities/unit.entity';
import { RealtimeGateway } from '../realtime/realtime.gateway';

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
  ): Promise<UnitEntity[]> {
    return this.service.findAll({ status, sectorId, shift });
  }

  @Get('nearby')
  findNearby(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
  ): Promise<UnitEntity[]> {
    return this.service.findAvailableNearby({
      lat: parseFloat(lat),
      lng: parseFloat(lng),
    });
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
    });
  }
}
