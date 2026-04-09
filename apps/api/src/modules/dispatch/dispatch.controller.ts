import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { DispatchService } from './dispatch.service';
import type { SuggestedUnit } from './dispatch.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import type { JwtPayload } from '../../shared/decorators/current-user.decorator';
import { UserRole, AssignUnitDto } from '@velnari/shared-types';
import type { IncidentEntity } from '../../entities/incident.entity';

@Controller('incidents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DispatchController {
  constructor(private readonly dispatchService: DispatchService) {}

  @Get(':id/suggestions')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.SUPERVISOR)
  suggestUnits(
    @Param('id', ParseUUIDPipe) incidentId: string,
  ): Promise<SuggestedUnit[]> {
    return this.dispatchService.suggestUnits(incidentId);
  }

  @Post(':id/assign')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.SUPERVISOR)
  assignUnit(
    @Param('id', ParseUUIDPipe) incidentId: string,
    @Body() dto: AssignUnitDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<IncidentEntity> {
    return this.dispatchService.assignUnit(incidentId, dto.unitId, user.sub);
  }
}
