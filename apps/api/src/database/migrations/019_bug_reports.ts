import { MigrationInterface, QueryRunner } from 'typeorm';

export class BugReports1712900000019 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bug_reports_status_enum') THEN
          CREATE TYPE bug_reports_status_enum AS ENUM ('open', 'investigating', 'resolved', 'dismissed');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bug_reports_severity_enum') THEN
          CREATE TYPE bug_reports_severity_enum AS ENUM ('low', 'medium', 'high', 'critical');
        END IF;
      END$$;

      CREATE TABLE IF NOT EXISTS bug_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        reporter_id UUID NOT NULL,
        reporter_email VARCHAR NOT NULL,
        reporter_role VARCHAR NOT NULL,
        description TEXT NOT NULL,
        screenshot_url TEXT,
        context JSONB NOT NULL DEFAULT '{}',
        logs JSONB NOT NULL DEFAULT '[]',
        status bug_reports_status_enum NOT NULL DEFAULT 'open',
        severity bug_reports_severity_enum NOT NULL DEFAULT 'medium',
        admin_notes TEXT,
        tenant_id UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON bug_reports(status);
      CREATE INDEX IF NOT EXISTS idx_bug_reports_created_at ON bug_reports(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_bug_reports_tenant ON bug_reports(tenant_id) WHERE tenant_id IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_bug_reports_tenant;
      DROP INDEX IF EXISTS idx_bug_reports_created_at;
      DROP INDEX IF EXISTS idx_bug_reports_status;
      DROP TABLE IF EXISTS bug_reports;
      DROP TYPE IF EXISTS bug_reports_severity_enum;
      DROP TYPE IF EXISTS bug_reports_status_enum;
    `);
  }
}
