import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '@velnari/shared-types';
import type { ChatMessageEntity } from '../../entities/chat-message.entity';
import type { Request } from 'express';

@Controller('chat')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChatController {
  constructor(private readonly service: ChatService) {}

  @Get(':roomId')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.FIELD_UNIT, UserRole.COMMANDER)
  getMessages(
    @Param('roomId') roomId: string,
    @Query('limit') limit?: string,
  ): Promise<ChatMessageEntity[]> {
    return this.service.getMessages(roomId, limit ? parseInt(limit, 10) : 50);
  }

  @Post(':roomId')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.FIELD_UNIT, UserRole.COMMANDER)
  async sendMessage(
    @Param('roomId') roomId: string,
    @Body() body: { content: string },
    @Req() req: Request & { user: { sub: string; role: string } },
  ): Promise<ChatMessageEntity> {
    const senderName = await this.service.getSenderName(req.user.sub);
    return this.service.sendMessage(
      roomId,
      req.user.sub,
      senderName,
      req.user.role,
      body.content,
    );
  }
}
