// apps/api/src/entities/patrol.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UnitEntity } from './unit.entity';
import { SectorEntity } from './sector.entity';
import { UserEntity } from './user.entity';

export enum PatrolStatus {
  SCHEDULED = 'scheduled',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('patrols')
export class PatrolEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'unit_id', type: 'uuid' })
  unitId!: string;

  @ManyToOne(() => UnitEntity)
  @JoinColumn({ name: 'unit_id' })
  unit?: UnitEntity;

  @Column({ name: 'sector_id', type: 'uuid' })
  sectorId!: string;

  @ManyToOne(() => SectorEntity)
  @JoinColumn({ name: 'sector_id' })
  sector?: SectorEntity;

  @Column({
    type: 'enum',
    enum: PatrolStatus,
    default: PatrolStatus.SCHEDULED,
  })
  status!: PatrolStatus;

  @Column({ name: 'start_at', type: 'timestamptz' })
  startAt!: Date;

  @Column({ name: 'end_at', type: 'timestamptz' })
  endAt!: Date;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'created_by' })
  creator?: UserEntity;

  @Column({ name: 'tenant_id', nullable: true, type: 'uuid' })
  tenantId?: string | null;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt?: Date;

  @Column({ name: 'accepted_by', type: 'uuid', nullable: true })
  acceptedBy?: string;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'accepted_by' })
  acceptor?: UserEntity;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
