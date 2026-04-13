import { MigrationInterface, QueryRunner } from 'typeorm';

// Adds PostGIS spatial indexes for hot geographic queries (nearby units,
// dispatch suggestions, heatmap) and time-series indexes for audit log
// retention/archival. CREATE INDEX CONCURRENTLY is used so migration does
// not block live traffic — but TypeORM wraps migrations in a transaction
// which disallows CONCURRENTLY. We use IF NOT EXISTS + the non-concurrent
// form; in prod the migration window is short enough.
export class SpatialAndRetentionIndexes1712900000016 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      -- GiST spatial index on units.current_location for ST_Distance / ST_DWithin queries.
      -- Used by dispatch.suggestUnits and units/nearby endpoints.
      CREATE INDEX IF NOT EXISTS idx_units_current_location_gist
        ON units USING GIST (current_location)
        WHERE current_location IS NOT NULL;

      -- Spatial index on unit_location_history if the column exists (safe no-op otherwise).
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'unit_location_history' AND column_name = 'location'
        ) THEN
          EXECUTE 'CREATE INDEX IF NOT EXISTS idx_unit_loc_hist_location_gist
                   ON unit_location_history USING GIST (location)';
        END IF;
      END $$;

      -- Incidents are queried heavily by (status, priority, created_at) in dashboards.
      -- Composite index speeds up the "open high-priority incidents today" query path.
      CREATE INDEX IF NOT EXISTS idx_incidents_status_priority_created
        ON incidents (status, priority, created_at DESC);

      -- Audit log retention: index created_at alone so a cron job can cheaply
      -- DELETE rows older than retention threshold (e.g. 2 years).
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
        ON audit_logs (created_at);

      -- Incident events by (incidentId, created_at) — timeline view in incident detail modal.
      CREATE INDEX IF NOT EXISTS idx_incident_events_incident_created
        ON incident_events (incident_id, created_at DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_units_current_location_gist;
      DROP INDEX IF EXISTS idx_unit_loc_hist_location_gist;
      DROP INDEX IF EXISTS idx_incidents_status_priority_created;
      DROP INDEX IF EXISTS idx_audit_logs_created_at;
      DROP INDEX IF EXISTS idx_incident_events_incident_created;
    `);
  }
}
