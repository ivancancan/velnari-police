import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UnitStatus } from '@velnari/shared-types';
import { SectorEntity } from './sector.entity';
import { UserEntity } from './user.entity';

@Entity('units')
export class UnitEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'call_sign', unique: true })
  callSign!: string;

  @Column({
    type: 'enum',
    enum: UnitStatus,
    default: UnitStatus.AVAILABLE,
  })
  status!: UnitStatus;

  @Column({ name: 'sector_id', nullable: true, type: 'uuid' })
  sectorId?: string;

  @ManyToOne(() => SectorEntity, { nullable: true, eager: false })
  @JoinColumn({ name: 'sector_id' })
  sector?: SectorEntity;

  @Column({ nullable: true })
  shift?: string;

  @Column({ name: 'assigned_user_id', nullable: true, type: 'uuid' })
  assignedUserId?: string;

  @ManyToOne(() => UserEntity, { nullable: true, eager: false })
  @JoinColumn({ name: 'assigned_user_id' })
  assignedUser?: UserEntity;

  @Column({
    name: 'current_location',
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
    select: false,
  })
  currentLocation?: string;

  @Column({ name: 'last_location_at', nullable: true })
  lastLocationAt?: Date;

  @Column({ name: 'tenant_id', nullable: true, type: 'uuid' })
  tenantId?: string | null;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
