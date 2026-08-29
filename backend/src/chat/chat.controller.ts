import { Controller, Delete, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(
    private chatService: ChatService,
    private chatGateway: ChatGateway,
  ) {}

  // Load message history over REST with cursor pagination; live messages arrive over the socket.
  @Get(':matchId/history')
  async history(
    @Param('matchId') matchId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @CurrentUser() userId?: string,
  ) {
    if (userId) {
      await this.chatService.markMessagesAsRead(matchId, userId);
    }
    return this.chatService.getHistory(matchId, cursor, limit);
  }

  @Delete(':matchId/clear')
  async clearChat(
    @Param('matchId') matchId: string,
    @CurrentUser() userId: string,
  ) {
    const result = await this.chatService.clearMessages(matchId, userId);
    // Real-time broadcast chatCleared event to the match room
    try {
      this.chatGateway.server?.to(`match:${matchId}`).emit('chatCleared', { matchId });
    } catch (e) {
      console.error('Failed to emit chatCleared event:', e);
    }
    return result;
  }
}
