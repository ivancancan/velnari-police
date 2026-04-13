import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// API keys for external system integration (e.g. C5 Jalisco, 911 dispatch).
// Never store the raw key — only a SHA-256 hash. The plain key is returned
// ONCE at creation and shown to the admin to copy into the external system.

@Entity('api_keys')
@Index(['keyHash'], { unique: true })
export class ApiKeyEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Human-friendly label: "C5 Jalisco", "911 Guadalajara", etc. */
  @Column({ length: 120 })
  name!: string;

  /** SHA-256 hex of the raw key. Raw key never persisted. */
  @Column({ name: 'key_hash', length: 64 })
  keyHash!: string;

  /** Short prefix shown in the UI so admins can identify which key is which without exposing the secret. */
  @Column({ length: 12 })
  prefix!: string;

  /** Scopes the key grants — currently just 'incident.ingest' is supported. */
  @Column({ type: 'text', array: true, default: '{incident.ingest}' })
  scopes!: string[];

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt?: Date | null;

  @Column({ name: 'use_count', type: 'int', default: 0 })
  useCount!: number;

  @Column({ name: 'tenant_id', nullable: true, type: 'uuid' })
  tenantId?: string | null;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
