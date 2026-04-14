import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { BugReportsService } from './bug-reports.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentUser, type JwtPayload } from '../../shared/decorators/current-user.decorator';
import { UserRole } from '@velnari/shared-types';
import { S3Service } from '../attachments/s3.service';
import type {
  BugReportSeverity,
  BugReportStatus,
} from '../../entities/bug-report.entity';

// Multer file (multer types aren't always resolved with pnpm symlinks)
interface UploadedFileLike {
  path: string;
  mimetype: string;
  size: number;
}

@ApiTags('support')
@Controller('support')
@UseGuards(JwtAuthGuard)
export class BugReportsController {
  constructor(
    private readonly service: BugReportsService,
    private readonly s3: S3Service,
  ) {}

  // ─── Any authenticated user can submit ───────────────────────────────
  @Post('bug-reports')
  @UseInterceptors(FileInterceptor('screenshot'))
  // Keep this liberal — a user crashing once a minute still gets capped at 10
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async submit(
    @UploadedFile() screenshot: UploadedFileLike | undefined,
    @Body()
    body: {
      description: string;
      context?: string; // JSON string
      logs?: string;    // JSON string
      severity?: BugReportSeverity;
    },
    @CurrentUser() user: JwtPayload,
  ) {
    let screenshotUrl: string | undefined;
    if (screenshot) {
      try {
        screenshotUrl = await this.s3.upload(screenshot.path, screenshot.mimetype);
      } catch {
        // Upload failure shouldn't block the report itself
      }
    }

    const parseJson = <T>(s: string | undefined, fallback: T): T => {
      if (!s) return fallback;
      try {
        return JSON.parse(s) as T;
      } catch {
        return fallback;
      }
    };

    return this.service.create({
      reporterId: user.sub,
      description: body.description ?? '(sin descripción)',
      screenshotUrl,
      context: parseJson(body.context, {}),
      logs: parseJson(body.logs, []),
      severity: body.severity,
    });
  }

  // ─── Admin-only: list + triage ───────────────────────────────────────
  @Get('bug-reports')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  async list(
    @Query('status') status?: BugReportStatus,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.service.list({
      status,
      limit: parseInt(limit ?? '50', 10),
      offset: parseInt(offset ?? '0', 10),
      tenantId: user?.tenantId ?? null,
    });
  }

  @Get('bug-reports/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Patch('bug-reports/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { status?: BugReportStatus; adminNotes?: string },
  ) {
    return this.service.updateStatus(
      id,
      body.status ?? 'open',
      body.adminNotes,
    );
  }
}
