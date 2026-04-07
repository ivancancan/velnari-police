import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1704067200000 implements MigrationInterface {
  name = 'InitialSchema1704067200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "postgis"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TYPE user_role AS ENUM ('admin', 'operator', 'supervisor', 'commander', 'field_unit')
    `);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "email"        VARCHAR NOT NULL UNIQUE,
        "password_hash" VARCHAR NOT NULL,
        "role"         user_role NOT NULL,
        "name"         VARCHAR NOT NULL,
        "badge_number" VARCHAR UNIQUE,
        "sector_id"    UUID,
        "is_active"    BOOLEAN NOT NULL DEFAULT true,
        "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id"          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "entity_type" VARCHAR NOT NULL,
        "entity_id"   VARCHAR NOT NULL,
        "action"      VARCHAR NOT NULL,
        "actor_id"    UUID NOT NULL,
        "changes"     JSONB,
        "ip_address"  VARCHAR,
        "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_audit_entity" ON "audit_logs" ("entity_type", "entity_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_audit_actor" ON "audit_logs" ("actor_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "user_role"`);
  }
}
