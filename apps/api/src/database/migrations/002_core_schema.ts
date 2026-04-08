import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CoreSchema1704153600000 implements MigrationInterface {
  name = 'CoreSchema1704153600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // ─── Enums ──────────────────────────────────────────────────────────────

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE unit_status AS ENUM ('available', 'en_route', 'on_scene', 'out_of_service');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE incident_priority AS ENUM ('critical', 'high', 'medium', 'low');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE incident_status AS ENUM ('open', 'assigned', 'en_route', 'on_scene', 'closed');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE incident_type AS ENUM ('robbery', 'assault', 'traffic', 'noise', 'domestic', 'missing_person', 'other');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // ─── Tabla: sectors ──────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE "sectors" (
        "id"         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name"       VARCHAR NOT NULL UNIQUE,
        "boundary"   geometry(Polygon, 4326),
        "color"      VARCHAR NOT NULL DEFAULT '#3B82F6',
        "is_active"  BOOLEAN NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_sectors_boundary" ON "sectors" USING GIST ("boundary")
    `);

    // ─── Tabla: units ─────────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE "units" (
        "id"               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "call_sign"        VARCHAR NOT NULL UNIQUE,
        "status"           unit_status NOT NULL DEFAULT 'available',
        "sector_id"        UUID REFERENCES "sectors"("id"),
        "shift"            VARCHAR,
        "assigned_user_id" UUID REFERENCES "users"("id"),
        "current_location" geometry(Point, 4326),
        "last_location_at" TIMESTAMPTZ,
        "is_active"        BOOLEAN NOT NULL DEFAULT true,
        "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_units_status" ON "units" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_units_sector" ON "units" ("sector_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_units_location" ON "units" USING GIST ("current_location")
    `);

    // ─── Tabla: incidents ─────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE "incidents" (
        "id"               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "folio"            VARCHAR NOT NULL UNIQUE,
        "type"             incident_type NOT NULL,
        "priority"         incident_priority NOT NULL,
        "status"           incident_status NOT NULL DEFAULT 'open',
        "address"          VARCHAR,
        "description"      TEXT,
        "location"         geometry(Point, 4326) NOT NULL,
        "lat"              DECIMAL(10,7) NOT NULL,
        "lng"              DECIMAL(10,7) NOT NULL,
        "sector_id"        UUID REFERENCES "sectors"("id"),
        "assigned_unit_id" UUID REFERENCES "units"("id"),
        "created_by"       UUID NOT NULL REFERENCES "users"("id"),
        "assigned_at"      TIMESTAMPTZ,
        "arrived_at"       TIMESTAMPTZ,
        "closed_at"        TIMESTAMPTZ,
        "resolution"       VARCHAR,
        "resolution_notes" TEXT,
        "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_incidents_status" ON "incidents" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_incidents_sector" ON "incidents" ("sector_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_incidents_location" ON "incidents" USING GIST ("location")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_incidents_created_at" ON "incidents" ("created_at" DESC)
    `);

    // ─── Tabla: incident_events ───────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE "incident_events" (
        "id"          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "incident_id" UUID NOT NULL REFERENCES "incidents"("id") ON DELETE CASCADE,
        "type"        VARCHAR NOT NULL,
        "description" TEXT NOT NULL,
        "actor_id"    UUID NOT NULL REFERENCES "users"("id"),
        "metadata"    JSONB,
        "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_events_incident" ON "incident_events" ("incident_id", "created_at")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "incident_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "incidents"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "units"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sectors"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "incident_type"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "incident_status"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "incident_priority"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "unit_status"`);
  }
}
