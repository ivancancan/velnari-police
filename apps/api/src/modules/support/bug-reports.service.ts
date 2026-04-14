import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BugReportEntity,
  type BugReportSeverity,
  type BugReportStatus,
} from '../../entities/bug-report.entity';
import { UserEntity } from '../../entities/user.entity';

export interface CreateBugReportInput {
  reporterId: string;
  description: string;
  screenshotUrl?: string;
  context?: Record<string, unknown>;
  logs?: Array<{ t: string; level: string; msg: string }>;
  severity?: BugReportSeverity;
}

@Injectable()
export class BugReportsService {
  constructor(
    @InjectRepository(BugReportEntity)
    private readonly repo: Repository<BugReportEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  async create(input: CreateBugReportInput): Promise<BugReportEntity> {
    const user = await this.userRepo.findOne({ where: { id: input.reporterId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const report = this.repo.create({
      reporterId: user.id,
      reporterEmail: user.email,
      reporterRole: user.role,
      description: input.description.slice(0, 4_000),
      screenshotUrl: input.screenshotUrl,
      context: input.context ?? {},
      logs: (input.logs ?? []).slice(-50),
      severity: input.severity ?? 'medium',
      status: 'open',
      tenantId: user.tenantId ?? null,
    });
    return this.repo.save(report);
  }

  async list(filters: {
    status?: BugReportStatus;
    limit?: number;
    offset?: number;
    tenantId?: string | null;
  }): Promise<BugReportEntity[]> {
    const qb = this.repo.createQueryBuilder('r').orderBy('r.createdAt', 'DESC');
    if (filters.status) qb.andWhere('r.status = :status', { status: filters.status });
    if (filters.tenantId !== undefined && filters.tenantId !== null) {
      qb.andWhere('r.tenantId = :tid', { tid: filters.tenantId });
    }
    qb.limit(Math.min(filters.limit ?? 50, 200)).offset(filters.offset ?? 0);
    return qb.getMany();
  }

  async updateStatus(
    id: string,
    status: BugReportStatus,
    adminNotes?: string,
  ): Promise<BugReportEntity> {
    const report = await this.repo.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Reporte no encontrado');
    report.status = status;
    if (adminNotes !== undefined) report.adminNotes = adminNotes;
    return this.repo.save(report);
  }

  async findOne(id: string): Promise<BugReportEntity> {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('Reporte no encontrado');
    return r;
  }
}
