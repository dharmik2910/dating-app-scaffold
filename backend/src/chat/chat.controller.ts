import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
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

  @Post(':matchId/date-invite')
  async sendDateInvite(
    @Param('matchId') matchId: string,
    @CurrentUser() userId: string,
    @Body()
    body: {
      venueName: string;
      address?: string;
      dateTime: string;
      notes?: string;
    },
  ) {
    const message = await this.chatService.saveMessage(
      matchId,
      userId,
      `📅 Date Invitation: Let's meet at ${body.venueName}!`,
      undefined,
      'date_invite',
      false,
      {
        venueName: body.venueName,
        address: body.address || '',
        dateTime: body.dateTime,
        notes: body.notes || '',
        status: 'pending',
      },
    );

    this.chatGateway.server?.to(`match:${matchId}`).emit('newMessage', message);
    return message;
  }

  @Patch(':matchId/date-invite/:messageId')
  async respondDateInvite(
    @Param('matchId') matchId: string,
    @Param('messageId') messageId: string,
    @CurrentUser() userId: string,
    @Body('response') response: 'accepted' | 'declined',
  ) {
    const updated = await this.chatService.respondDateInvite(
      matchId,
      messageId,
      userId,
      response,
    );
    this.chatGateway.server?.to(`match:${matchId}`).emit('dateInviteUpdated', updated);
    return updated;
  }

  @Post(':matchId/ephemeral/:messageId/view')
  async viewEphemeral(
    @Param('matchId') matchId: string,
    @Param('messageId') messageId: string,
    @CurrentUser() userId: string,
  ) {
    const updated = await this.chatService.viewEphemeralMedia(messageId, userId);
    try {
      this.chatGateway.server?.to(`match:${matchId}`).emit('ephemeralViewed', {
        matchId,
        messageId,
        viewedAt: updated.viewedAt,
      });
    } catch (e) {
      console.warn('Failed to emit ephemeralViewed socket event:', e);
    }
    return updated;
  }


  @Delete(':matchId/clear')
  async clearChat(
    @Param('matchId') matchId: string,
    @CurrentUser() userId: string,
  ) {
    const result = await this.chatService.clearMessages(matchId, userId);
    try {
      this.chatGateway.server?.to(`match:${matchId}`).emit('chatCleared', { matchId });
    } catch (e) {
      console.error('Failed to emit chatCleared event:', e);
    }
    return result;
  }
}
