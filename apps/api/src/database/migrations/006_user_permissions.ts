import type { MigrationInterface, QueryRunner } from 'typeorm';

export class UserPermissions1712534400000 implements MigrationInterface {
  name = 'UserPermissions1712534400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "custom_permissions" JSONB NOT NULL DEFAULT '[]'::jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "shift" VARCHAR
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "custom_permissions"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "shift"`);
  }
}
