import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// User-submitted bug reports with attached screenshot + device context
// + recent logs. Populated by the in-app "Reportar problema" form and
// reviewed by admins at /admin/bug-reports.

export type BugReportStatus = 'open' | 'investigating' | 'resolved' | 'dismissed';
export type BugReportSeverity = 'low' | 'medium' | 'high' | 'critical';

@Entity('bug_reports')
@Index(['status'])
@Index(['createdAt'])
export class BugReportEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'reporter_id', type: 'uuid' })
  reporterId!: string;

  @Column({ name: 'reporter_email' })
  reporterEmail!: string;

  @Column({ name: 'reporter_role' })
  reporterRole!: string;

  @Column({ type: 'text' })
  description!: string;

  /** Screenshot URL (S3 or local /uploads) — optional. */
  @Column({ name: 'screenshot_url', nullable: true })
  screenshotUrl?: string;

  /** Device + platform info: { platform, osVersion, appVersion, deviceModel } */
  @Column({ type: 'jsonb', default: {} })
  context!: Record<string, unknown>;

  /** Last 50 console.log/warn/error entries captured by the client buffer. */
  @Column({ type: 'jsonb', default: [] })
  logs!: Array<{ t: string; level: string; msg: string }>;

  @Column({ type: 'enum', enum: ['open', 'investigating', 'resolved', 'dismissed'], default: 'open' })
  status!: BugReportStatus;

  @Column({
    type: 'enum',
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
  })
  severity!: BugReportSeverity;

  @Column({ name: 'admin_notes', type: 'text', nullable: true })
  adminNotes?: string;

  @Column({ name: 'tenant_id', nullable: true, type: 'uuid' })
  tenantId?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
