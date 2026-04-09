import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatMessageEntity } from '../../entities/chat-message.entity';
import { UserEntity } from '../../entities/user.entity';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatMessageEntity)
    private readonly repo: Repository<ChatMessageEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
    private readonly realtime: RealtimeGateway,
  ) {}

  async getMessages(roomId: string, limit = 50): Promise<ChatMessageEntity[]> {
    return this.repo.find({
      where: { roomId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getSenderName(userId: string): Promise<string> {
    const user = await this.usersRepo.findOne({ where: { id: userId }, select: ['name'] });
    return user?.name ?? 'Desconocido';
  }

  async sendMessage(
    roomId: string,
    senderId: string,
    senderName: string,
    senderRole: string,
    content: string,
  ): Promise<ChatMessageEntity> {
    const message = this.repo.create({
      roomId,
      senderId,
      senderName,
      senderRole,
      content,
    });
    const saved = await this.repo.save(message);
    this.realtime.emitChatMessage(roomId, saved as unknown as Record<string, unknown>);
    return saved;
  }
}
