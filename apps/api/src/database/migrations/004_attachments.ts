import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Attachments1704240000000 implements MigrationInterface {
  name = 'Attachments1704240000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "incident_attachments" (
        "id"            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "incident_id"   UUID NOT NULL REFERENCES "incidents"("id") ON DELETE CASCADE,
        "filename"      VARCHAR NOT NULL,
        "original_name" VARCHAR NOT NULL,
        "mimetype"      VARCHAR NOT NULL,
        "size"          INTEGER NOT NULL,
        "url"           VARCHAR NOT NULL,
        "uploaded_by"   UUID NOT NULL REFERENCES "users"("id"),
        "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_attachments_incident" ON "incident_attachments" ("incident_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "incident_attachments"`);
  }
}
