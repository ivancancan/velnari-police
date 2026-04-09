import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { UserEntity } from './user.entity';

@Entity('chat_messages')
export class ChatMessageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'room_id' })
  roomId!: string; // 'command' or 'incident:{id}' or 'unit:{id}'

  @Column({ name: 'sender_id', type: 'uuid' })
  senderId!: string;

  @ManyToOne(() => UserEntity, { eager: false })
  @JoinColumn({ name: 'sender_id' })
  sender?: UserEntity;

  @Column({ name: 'sender_name' })
  senderName!: string;

  @Column({ name: 'sender_role' })
  senderRole!: string;

  @Column('text')
  content!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
