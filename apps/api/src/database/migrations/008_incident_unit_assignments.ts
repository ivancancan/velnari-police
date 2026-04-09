import { MigrationInterface, QueryRunner } from 'typeorm';

export class IncidentUnitAssignments1712600000008 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE incident_unit_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
        unit_id UUID NOT NULL REFERENCES units(id),
        assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        unassigned_at TIMESTAMP WITH TIME ZONE,
        assigned_by UUID REFERENCES users(id),
        UNIQUE(incident_id, unit_id)
      );
      CREATE INDEX idx_iua_incident ON incident_unit_assignments(incident_id);
      CREATE INDEX idx_iua_unit ON incident_unit_assignments(unit_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS incident_unit_assignments');
  }
}
