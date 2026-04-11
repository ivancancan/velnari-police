import { MigrationInterface, QueryRunner } from 'typeorm';

export class PushTokens1712986000014 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS expo_push_token VARCHAR(512);
      CREATE INDEX IF NOT EXISTS idx_users_expo_push_token ON users(expo_push_token) WHERE expo_push_token IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_users_expo_push_token;
      ALTER TABLE users DROP COLUMN IF EXISTS expo_push_token;
    `);
  }
}
