import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChatMessages1712500000007 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE chat_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        room_id VARCHAR(255) NOT NULL,
        sender_id UUID NOT NULL REFERENCES users(id),
        sender_name VARCHAR(255) NOT NULL,
        sender_role VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX idx_chat_room_created ON chat_messages(room_id, created_at DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS chat_messages');
  }
}
