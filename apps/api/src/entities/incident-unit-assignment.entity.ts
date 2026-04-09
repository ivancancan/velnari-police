import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { IncidentEntity } from './incident.entity';
import { UnitEntity } from './unit.entity';

@Entity('incident_unit_assignments')
export class IncidentUnitAssignmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'incident_id', type: 'uuid' })
  incidentId!: string;

  @ManyToOne(() => IncidentEntity)
  @JoinColumn({ name: 'incident_id' })
  incident?: IncidentEntity;

  @Column({ name: 'unit_id', type: 'uuid' })
  unitId!: string;

  @ManyToOne(() => UnitEntity, { eager: true })
  @JoinColumn({ name: 'unit_id' })
  unit?: UnitEntity;

  @CreateDateColumn({ name: 'assigned_at' })
  assignedAt!: Date;

  @Column({ name: 'unassigned_at', nullable: true })
  unassignedAt?: Date;

  @Column({ name: 'assigned_by', nullable: true, type: 'uuid' })
  assignedBy?: string;
}
