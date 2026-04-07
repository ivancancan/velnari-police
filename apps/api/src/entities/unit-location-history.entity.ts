import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UnitEntity } from './unit.entity';

@Entity('unit_location_history')
@Index(['unitId', 'recordedAt'], { synchronize: false })
export class UnitLocationHistoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'unit_id', type: 'uuid' })
  unitId!: string;

  @ManyToOne(() => UnitEntity, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'unit_id' })
  unit?: UnitEntity;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  lat!: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  lng!: number;

  @Column({
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
    select: false,
  })
  location?: string;

  @CreateDateColumn({ name: 'recorded_at' })
  recordedAt!: Date;
}
