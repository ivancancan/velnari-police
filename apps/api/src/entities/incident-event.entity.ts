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

@Entity('incident_events')
export class IncidentEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'incident_id', type: 'uuid' })
  incidentId!: string;

  @ManyToOne(() => IncidentEntity, (i) => i.events, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'incident_id' })
  incident!: IncidentEntity;

  @Column()
  type!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ name: 'actor_id', type: 'uuid' })
  actorId!: string;

  @ManyToOne(() => UserEntity, { eager: false })
  @JoinColumn({ name: 'actor_id' })
  actor?: UserEntity;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
