import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('audit_logs')
@Index(['entityType', 'entityId'])
@Index(['actorId'])
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'entity_type' })
  entityType!: string;

  @Column({ name: 'entity_id' })
  entityId!: string;

  @Column()
  action!: string;

  @Column({ name: 'actor_id', type: 'uuid' })
  actorId!: string;

  @Column({ type: 'jsonb', nullable: true })
  changes?: Record<string, unknown>;

  @Column({ name: 'ip_address', nullable: true })
  ipAddress?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
