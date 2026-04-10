import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase3Schema1712900000013 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      -- Evidence chain of custody columns
      ALTER TABLE incident_attachments ADD COLUMN IF NOT EXISTS sha256_hash VARCHAR(64);
      ALTER TABLE incident_attachments ADD COLUMN IF NOT EXISTS gps_lat DECIMAL(10,7);
      ALTER TABLE incident_attachments ADD COLUMN IF NOT EXISTS gps_lng DECIMAL(10,7);
      ALTER TABLE incident_attachments ADD COLUMN IF NOT EXISTS captured_at TIMESTAMP WITH TIME ZONE;

      -- Citizen tracking: add tracking_token to incidents for anonymous status checks
      ALTER TABLE incidents ADD COLUMN IF NOT EXISTS tracking_token VARCHAR(12);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_incidents_tracking ON incidents(tracking_token) WHERE tracking_token IS NOT NULL;

      -- Auto-dispatch flag: mark incidents that were auto-dispatched
      ALTER TABLE incidents ADD COLUMN IF NOT EXISTS auto_dispatched BOOLEAN DEFAULT FALSE;

      -- Multi-tenancy foundation: tenant_id on core tables
      ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id UUID;
      ALTER TABLE units ADD COLUMN IF NOT EXISTS tenant_id UUID;
      ALTER TABLE incidents ADD COLUMN IF NOT EXISTS tenant_id UUID;
      ALTER TABLE sectors ADD COLUMN IF NOT EXISTS tenant_id UUID;
      CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id) WHERE tenant_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_units_tenant ON units(tenant_id) WHERE tenant_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_incidents_tenant ON incidents(tenant_id) WHERE tenant_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_sectors_tenant ON sectors(tenant_id) WHERE tenant_id IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_sectors_tenant;
      DROP INDEX IF EXISTS idx_incidents_tenant;
      DROP INDEX IF EXISTS idx_units_tenant;
      DROP INDEX IF EXISTS idx_users_tenant;
      ALTER TABLE sectors DROP COLUMN IF EXISTS tenant_id;
      ALTER TABLE incidents DROP COLUMN IF EXISTS tenant_id;
      ALTER TABLE units DROP COLUMN IF EXISTS tenant_id;
      ALTER TABLE users DROP COLUMN IF EXISTS tenant_id;
      ALTER TABLE incidents DROP COLUMN IF EXISTS auto_dispatched;
      DROP INDEX IF EXISTS idx_incidents_tracking;
      ALTER TABLE incidents DROP COLUMN IF EXISTS tracking_token;
      ALTER TABLE incident_attachments DROP COLUMN IF EXISTS captured_at;
      ALTER TABLE incident_attachments DROP COLUMN IF EXISTS gps_lng;
      ALTER TABLE incident_attachments DROP COLUMN IF EXISTS gps_lat;
      ALTER TABLE incident_attachments DROP COLUMN IF EXISTS sha256_hash;
    `);
  }
}
