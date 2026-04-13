import { MigrationInterface, QueryRunner } from 'typeorm';

export class ApiKeys1712900000018 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(120) NOT NULL,
        key_hash VARCHAR(64) NOT NULL,
        prefix VARCHAR(12) NOT NULL,
        scopes TEXT[] NOT NULL DEFAULT ARRAY['incident.ingest'],
        created_by UUID NOT NULL,
        last_used_at TIMESTAMPTZ,
        use_count INTEGER NOT NULL DEFAULT 0,
        tenant_id UUID,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_hash
        ON api_keys(key_hash) WHERE deleted_at IS NULL;

      CREATE INDEX IF NOT EXISTS idx_api_keys_tenant
        ON api_keys(tenant_id) WHERE deleted_at IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_api_keys_tenant;
      DROP INDEX IF EXISTS idx_api_keys_hash;
      DROP TABLE IF EXISTS api_keys;
    `);
  }
}
