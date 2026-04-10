import {
  Column, CreateDateColumn, Entity, JoinColumn,
  ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { UnitEntity } from './unit.entity';
import { UserEntity } from './user.entity';
import { SectorEntity } from './sector.entity';

export enum ShiftStatus {
  SCHEDULED = 'scheduled',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('shifts')
export class ShiftEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'unit_id', type: 'uuid' })
  unitId!: string;

  @ManyToOne(() => UnitEntity)
  @JoinColumn({ name: 'unit_id' })
  unit?: UnitEntity;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: UserEntity;

  @Column({ name: 'sector_id', type: 'uuid', nullable: true })
  sectorId?: string;

  @ManyToOne(() => SectorEntity, { nullable: true })
  @JoinColumn({ name: 'sector_id' })
  sector?: SectorEntity;

  @Column({ name: 'start_at', type: 'timestamptz' })
  startAt!: Date;

  @Column({ name: 'end_at', type: 'timestamptz' })
  endAt!: Date;

  @Column({ type: 'varchar', length: 20, default: ShiftStatus.SCHEDULED })
  status!: ShiftStatus;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'handoff_notes', type: 'text', nullable: true })
  handoffNotes?: string;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'created_by' })
  creator?: UserEntity;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
