import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { IncidentPriority, IncidentStatus, IncidentType } from '@velnari/shared-types';
import { SectorEntity } from './sector.entity';
import { UnitEntity } from './unit.entity';
import { UserEntity } from './user.entity';
import { IncidentEventEntity } from './incident-event.entity';
import { PatrolEntity } from './patrol.entity';

@Entity('incidents')
export class IncidentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  folio!: string;

  @Column({ type: 'enum', enum: IncidentType })
  type!: IncidentType;

  @Column({ type: 'enum', enum: IncidentPriority })
  priority!: IncidentPriority;

  @Column({
    type: 'enum',
    enum: IncidentStatus,
    default: IncidentStatus.OPEN,
  })
  status!: IncidentStatus;

  @Column({ nullable: true })
  address?: string;

  @Column({ nullable: true, type: 'text' })
  description?: string;

  @Column({
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
    select: false,
  })
  location!: string;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  lat!: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  lng!: number;

  @Column({ name: 'sector_id', nullable: true, type: 'uuid' })
  sectorId?: string;

  @ManyToOne(() => SectorEntity, { nullable: true, eager: false })
  @JoinColumn({ name: 'sector_id' })
  sector?: SectorEntity;

  @Column({ name: 'assigned_unit_id', nullable: true, type: 'uuid' })
  assignedUnitId?: string;

  @ManyToOne(() => UnitEntity, { nullable: true, eager: false })
  @JoinColumn({ name: 'assigned_unit_id' })
  assignedUnit?: UnitEntity;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @ManyToOne(() => UserEntity, { eager: false })
  @JoinColumn({ name: 'created_by' })
  creator?: UserEntity;

  @Column({ name: 'assigned_at', nullable: true })
  assignedAt?: Date;

  @Column({ name: 'arrived_at', nullable: true })
  arrivedAt?: Date;

  @Column({ name: 'closed_at', nullable: true })
  closedAt?: Date;

  @Column({ nullable: true })
  resolution?: string;

  @Column({ name: 'resolution_notes', nullable: true, type: 'text' })
  resolutionNotes?: string;

  @Column({ name: 'patrol_id', nullable: true, type: 'uuid' })
  patrolId?: string;

  @ManyToOne(() => PatrolEntity, { nullable: true })
  @JoinColumn({ name: 'patrol_id' })
  patrol?: PatrolEntity;

  @Column({ name: 'merged_into', nullable: true, type: 'uuid' })
  mergedInto?: string;

  @Column({ name: 'auto_dispatched', default: false })
  autoDispatched!: boolean;

  @Column({ name: 'tracking_token', nullable: true, length: 12 })
  trackingToken?: string;

  @OneToMany(() => IncidentEventEntity, (e) => e.incident, { eager: false })
  events?: IncidentEventEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
