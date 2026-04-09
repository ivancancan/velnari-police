import { MigrationInterface, QueryRunner } from 'typeorm';

export class PerformanceIndexes1712800000010 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Incidents — frequently filtered columns
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_incidents_priority ON incidents(priority)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_incidents_sector ON incidents(sector_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_incidents_created ON incidents(created_at DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_incidents_assigned_unit ON incidents(assigned_unit_id)`);

    // Units — status filter
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_units_status ON units(status)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_units_sector ON units(sector_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_units_active ON units(is_active)`);

    // Audit logs — time-based queries
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type)`);

    // Users
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active)`);

    // Incident events
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_incident_events_incident ON incident_events(incident_id, created_at)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_incidents_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_incidents_priority`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_incidents_sector`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_incidents_created`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_incidents_assigned_unit`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_units_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_units_sector`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_units_active`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_created`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_entity`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_users_role`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_users_active`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_incident_events_incident`);
  }
}
