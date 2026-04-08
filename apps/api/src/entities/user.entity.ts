import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { UserRole } from '@velnari/shared-types';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Exclude()
  @Column({ name: 'password_hash' })
  passwordHash!: string;

  @Column({ type: 'enum', enum: UserRole })
  role!: UserRole;

  @Column()
  name!: string;

  @Column({ name: 'badge_number', nullable: true, unique: true })
  badgeNumber?: string;

  @Column({ name: 'sector_id', nullable: true, type: 'uuid' })
  sectorId?: string;

  @Column({ name: 'custom_permissions', type: 'jsonb', default: [] })
  customPermissions!: string[];

  @Column({ nullable: true })
  shift?: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
