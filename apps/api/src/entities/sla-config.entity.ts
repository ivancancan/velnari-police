import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('sla_config')
export class SlaConfigEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true, length: 20 })
  priority!: string;

  @Column({ name: 'target_response_minutes', type: 'integer' })
  targetResponseMinutes!: number;

  @Column({ name: 'target_resolution_minutes', type: 'integer', nullable: true })
  targetResolutionMinutes?: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
