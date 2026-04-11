import { MigrationInterface, QueryRunner } from 'typeorm';

export class Municipios1712900000015 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      -- Create municipios (tenants) table
      CREATE TABLE IF NOT EXISTS municipios (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL UNIQUE,
        state VARCHAR(100),
        slug VARCHAR(64) UNIQUE,
        contact_email VARCHAR(255),
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      -- Add tenant_id to remaining core tables that don't have it yet
      ALTER TABLE patrols ADD COLUMN IF NOT EXISTS tenant_id UUID;
      ALTER TABLE shifts ADD COLUMN IF NOT EXISTS tenant_id UUID;
      ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS tenant_id UUID;
      ALTER TABLE report_templates ADD COLUMN IF NOT EXISTS tenant_id UUID;

      -- Indexes for tenant filtering
      CREATE INDEX IF NOT EXISTS idx_patrols_tenant ON patrols(tenant_id) WHERE tenant_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_shifts_tenant ON shifts(tenant_id) WHERE tenant_id IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_shifts_tenant;
      DROP INDEX IF EXISTS idx_patrols_tenant;
      ALTER TABLE report_templates DROP COLUMN IF EXISTS tenant_id;
      ALTER TABLE chat_messages DROP COLUMN IF EXISTS tenant_id;
      ALTER TABLE shifts DROP COLUMN IF EXISTS tenant_id;
      ALTER TABLE patrols DROP COLUMN IF EXISTS tenant_id;
      DROP TABLE IF EXISTS municipios;
    `);
  }
}
