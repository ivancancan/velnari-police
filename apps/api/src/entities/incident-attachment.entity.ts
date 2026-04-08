// apps/api/src/entities/incident-attachment.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { IncidentEntity } from './incident.entity';
import { UserEntity } from './user.entity';

@Entity('incident_attachments')
export class IncidentAttachmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'incident_id', type: 'uuid' })
  incidentId!: string;

  @ManyToOne(() => IncidentEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'incident_id' })
  incident?: IncidentEntity;

  @Column()
  filename!: string;

  @Column({ name: 'original_name' })
  originalName!: string;

  @Column()
  mimetype!: string;

  @Column({ type: 'int' })
  size!: number;

  @Column()
  url!: string;

  @Column({ name: 'uploaded_by', type: 'uuid' })
  uploadedBy!: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'uploaded_by' })
  uploader?: UserEntity;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
