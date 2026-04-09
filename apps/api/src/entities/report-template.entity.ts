import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export interface TemplateField {
  id: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'multiselect' | 'date' | 'checkbox';
  label: string;
  required?: boolean;
  options?: string[]; // for select/multiselect
  placeholder?: string;
}

@Entity('report_templates')
export class ReportTemplateEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ nullable: true, type: 'text' })
  description?: string;

  @Column({ type: 'jsonb', default: '[]' })
  fields!: TemplateField[];

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ name: 'created_by', nullable: true, type: 'uuid' })
  createdBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
