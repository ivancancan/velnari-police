import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, ParseUUIDPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import type { JwtPayload } from '../../shared/decorators/current-user.decorator';
import { UserRole } from '@velnari/shared-types';

@Controller('shifts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShiftsController {
  constructor(private readonly service: ShiftsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.COMMANDER, UserRole.OPERATOR)
  findAll(
    @Query('unitId') unitId?: string, @Query('status') status?: string,
    @Query('from') from?: string, @Query('to') to?: string,
  ) {
    return this.service.findAll({
      unitId, status,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.COMMANDER)
  create(
    @Body() dto: { unitId: string; userId?: string; sectorId?: string; startAt: string; endAt: string; notes?: string },
    @CurrentUser() user: JwtPayload,
  ) { return this.service.create(dto, user.sub); }

  @Patch(':id/activate')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.COMMANDER)
  activate(@Param('id', ParseUUIDPipe) id: string) { return this.service.activate(id); }

  @Patch(':id/complete')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.COMMANDER, UserRole.FIELD_UNIT)
  complete(@Param('id', ParseUUIDPipe) id: string, @Body() body: { handoffNotes?: string }) {
    return this.service.complete(id, body.handoffNotes);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.COMMANDER)
  cancel(@Param('id', ParseUUIDPipe) id: string) { return this.service.cancel(id); }

  @Get('handoff/:unitId')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.COMMANDER, UserRole.FIELD_UNIT)
  getHandoff(@Param('unitId', ParseUUIDPipe) unitId: string) { return this.service.getHandoff(unitId); }
}
