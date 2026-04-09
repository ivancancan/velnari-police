import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import type { JwtPayload } from '../../shared/decorators/current-user.decorator';
import { UserRole } from '@velnari/shared-types';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  // Templates
  @Get('templates')
  getTemplates() {
    return this.service.findAllTemplates();
  }

  @Get('templates/:id')
  getTemplate(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOneTemplate(id);
  }

  @Post('templates')
  @Roles(UserRole.ADMIN, UserRole.COMMANDER)
  createTemplate(@Body() body: { name: string; description?: string; fields: unknown[] }, @CurrentUser() user: JwtPayload) {
    return this.service.createTemplate(body, user.sub);
  }

  @Patch('templates/:id')
  @Roles(UserRole.ADMIN, UserRole.COMMANDER)
  updateTemplate(@Param('id', ParseUUIDPipe) id: string, @Body() body: { name?: string; description?: string; fields?: unknown[] }) {
    return this.service.updateTemplate(id, body);
  }

  @Delete('templates/:id')
  @Roles(UserRole.ADMIN)
  deleteTemplate(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteTemplate(id);
  }

  // Submissions
  @Get('submissions')
  getSubmissions(@Query('templateId') templateId?: string, @Query('incidentId') incidentId?: string) {
    return this.service.findSubmissions(templateId, incidentId);
  }

  @Post('submissions')
  createSubmission(@Body() body: { templateId: string; incidentId?: string; data: Record<string, unknown> }, @CurrentUser() user: JwtPayload) {
    return this.service.createSubmission(body, user.sub);
  }
}
