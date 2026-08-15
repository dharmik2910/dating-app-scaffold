import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ChatService } from './chat.service';

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private chatService: ChatService) {}

  // Load message history over REST; live messages arrive over the socket.
  @Get(':matchId/history')
  history(@Param('matchId') matchId: string) {
    return this.chatService.getHistory(matchId);
  }
}
