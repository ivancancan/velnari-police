import { MigrationInterface, QueryRunner } from 'typeorm';

export class PatrolAcceptance1712900000011 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE patrols ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE patrols ADD COLUMN IF NOT EXISTS accepted_by UUID REFERENCES users(id);
      ALTER TABLE incidents ADD COLUMN IF NOT EXISTS patrol_id UUID REFERENCES patrols(id);
      CREATE INDEX IF NOT EXISTS idx_incidents_patrol ON incidents(patrol_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE incidents DROP COLUMN IF EXISTS patrol_id;
      ALTER TABLE patrols DROP COLUMN IF EXISTS accepted_by;
      ALTER TABLE patrols DROP COLUMN IF EXISTS accepted_at;
    `);
  }
}
