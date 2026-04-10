import { MigrationInterface, QueryRunner } from 'typeorm';

export class ShiftsAndSla1712900000012 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS shifts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        unit_id UUID NOT NULL REFERENCES units(id),
        user_id UUID REFERENCES users(id),
        sector_id UUID REFERENCES sectors(id),
        start_at TIMESTAMP WITH TIME ZONE NOT NULL,
        end_at TIMESTAMP WITH TIME ZONE NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
        notes TEXT,
        handoff_notes TEXT,
        created_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX idx_shifts_unit ON shifts(unit_id);
      CREATE INDEX idx_shifts_status ON shifts(status);
      CREATE INDEX idx_shifts_start ON shifts(start_at);

      CREATE TABLE IF NOT EXISTS sla_config (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        priority VARCHAR(20) NOT NULL UNIQUE,
        target_response_minutes INTEGER NOT NULL,
        target_resolution_minutes INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      INSERT INTO sla_config (priority, target_response_minutes, target_resolution_minutes) VALUES
        ('critical', 3, 30),
        ('high', 5, 60),
        ('medium', 15, 120),
        ('low', 30, 240)
      ON CONFLICT (priority) DO NOTHING;

      ALTER TABLE incidents ADD COLUMN IF NOT EXISTS merged_into UUID REFERENCES incidents(id);
      CREATE INDEX IF NOT EXISTS idx_incidents_merged ON incidents(merged_into) WHERE merged_into IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON chat_messages(room_id, created_at DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_chat_messages_room;
      ALTER TABLE incidents DROP COLUMN IF EXISTS merged_into;
      DROP TABLE IF EXISTS sla_config;
      DROP TABLE IF EXISTS shifts;
    `);
  }
}
