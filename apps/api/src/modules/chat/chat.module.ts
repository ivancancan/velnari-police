import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatMessageEntity } from '../../entities/chat-message.entity';
import { UserEntity } from '../../entities/user.entity';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatMessageEntity, UserEntity]),
    RealtimeModule,
  ],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
