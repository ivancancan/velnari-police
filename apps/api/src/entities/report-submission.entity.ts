import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ReportTemplateEntity } from './report-template.entity';
import { IncidentEntity } from './incident.entity';
import { UserEntity } from './user.entity';

@Entity('report_submissions')
export class ReportSubmissionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'template_id', type: 'uuid' })
  templateId!: string;

  @ManyToOne(() => ReportTemplateEntity, { eager: true })
  @JoinColumn({ name: 'template_id' })
  template?: ReportTemplateEntity;

  @Column({ name: 'incident_id', nullable: true, type: 'uuid' })
  incidentId?: string;

  @ManyToOne(() => IncidentEntity, { nullable: true })
  @JoinColumn({ name: 'incident_id' })
  incident?: IncidentEntity;

  @Column({ type: 'jsonb', default: '{}' })
  data!: Record<string, unknown>;

  @Column({ name: 'submitted_by', type: 'uuid' })
  submittedBy!: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'submitted_by' })
  submitter?: UserEntity;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
