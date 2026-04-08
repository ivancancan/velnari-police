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
import { SectorsService } from './sectors.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole, type CreateSectorDto, type UpdateSectorDto, type SetBoundaryDto } from '@velnari/shared-types';
import type { SectorEntity } from '../../entities/sector.entity';

@Controller('sectors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SectorsController {
  constructor(private readonly service: SectorsService) {}

  @Get()
  findAll(): Promise<SectorEntity[]> {
    return this.service.findAll();
  }

  @Get('with-boundary')
  findAllWithBoundary() {
    return this.service.findAllWithBoundary();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<SectorEntity> {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.COMMANDER)
  create(@Body() dto: CreateSectorDto): Promise<SectorEntity> {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.COMMANDER)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSectorDto,
  ): Promise<SectorEntity> {
    return this.service.update(id, dto);
  }

  @Patch(':id/boundary')
  @Roles(UserRole.ADMIN, UserRole.COMMANDER)
  setBoundary(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetBoundaryDto,
  ): Promise<SectorEntity> {
    return this.service.setBoundary(id, dto.coordinates);
  }
}
