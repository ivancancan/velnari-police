import { MigrationInterface, QueryRunner } from 'typeorm';

// Adds soft-delete support to the users table. Deleting a user must NOT
// cascade-break audit logs, incident events, or assignments — those must
// remain attributable. TypeORM auto-filters rows with non-null deleted_at
// via @DeleteDateColumn in the entity.
export class UserSoftDelete1712900000017 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

      -- Partial index so "find active users" queries skip deleted rows cheaply.
      CREATE INDEX IF NOT EXISTS idx_users_not_deleted ON users(id) WHERE deleted_at IS NULL;

      -- Preserve email uniqueness only among non-deleted users — otherwise
      -- re-onboarding a user with the same email would fail forever.
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_email_key') THEN
          ALTER TABLE users DROP CONSTRAINT users_email_key;
        END IF;
      END $$;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique_active
        ON users (email) WHERE deleted_at IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_users_email_unique_active;
      DROP INDEX IF EXISTS idx_users_not_deleted;
      ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
      ALTER TABLE users DROP COLUMN IF EXISTS deleted_at;
    `);
  }
}
