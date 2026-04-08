import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Patrols1704326400000 implements MigrationInterface {
  name = 'Patrols1704326400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE patrol_status AS ENUM ('scheduled', 'active', 'completed', 'cancelled');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE "patrols" (
        "id"         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "unit_id"    UUID NOT NULL REFERENCES "units"("id"),
        "sector_id"  UUID NOT NULL REFERENCES "sectors"("id"),
        "status"     patrol_status NOT NULL DEFAULT 'scheduled',
        "start_at"   TIMESTAMPTZ NOT NULL,
        "end_at"     TIMESTAMPTZ NOT NULL,
        "created_by" UUID NOT NULL REFERENCES "users"("id"),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_patrols_unit" ON "patrols" ("unit_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_patrols_sector" ON "patrols" ("sector_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_patrols_start" ON "patrols" ("start_at")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "patrols"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "patrol_status"`);
  }
}
