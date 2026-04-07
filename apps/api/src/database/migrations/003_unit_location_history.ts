import type { MigrationInterface, QueryRunner } from 'typeorm';

export class UnitLocationHistory1704240000000 implements MigrationInterface {
  name = 'UnitLocationHistory1704240000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "unit_location_history" (
        "id"          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "unit_id"     UUID NOT NULL REFERENCES "units"("id") ON DELETE CASCADE,
        "lat"         DECIMAL(10,7) NOT NULL,
        "lng"         DECIMAL(10,7) NOT NULL,
        "location"    geometry(Point, 4326),
        "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_location_history_unit_time"
        ON "unit_location_history" ("unit_id", "recorded_at" DESC)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "unit_location_history"`);
  }
}
