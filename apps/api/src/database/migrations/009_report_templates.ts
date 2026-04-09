import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReportTemplates1712700000009 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE report_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(200) NOT NULL,
        description TEXT,
        fields JSONB NOT NULL DEFAULT '[]',
        is_active BOOLEAN DEFAULT true,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE report_submissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        template_id UUID NOT NULL REFERENCES report_templates(id),
        incident_id UUID REFERENCES incidents(id),
        data JSONB NOT NULL DEFAULT '{}',
        submitted_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX idx_report_sub_template ON report_submissions(template_id);
      CREATE INDEX idx_report_sub_incident ON report_submissions(incident_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS report_submissions');
    await queryRunner.query('DROP TABLE IF EXISTS report_templates');
  }
}
