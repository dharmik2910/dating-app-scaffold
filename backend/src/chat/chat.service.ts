import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  async saveMessage(
    matchId: string,
    senderId: string,
    content: string,
    mediaUrl?: string,
    mediaType = 'text',
    isEphemeral = false,
    metadata?: any,
  ) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        user1: {
          include: {
            profile: true,
            photos: { orderBy: { order: 'asc' }, take: 1 },
          },
        },
        user2: {
          include: {
            profile: true,
            photos: { orderBy: { order: 'asc' }, take: 1 },
          },
        },
      },
    });

    if (!match || (match.user1Id !== senderId && match.user2Id !== senderId)) {
      throw new ForbiddenException('Not part of this match');
    }

    const message = await this.prisma.message.create({
      data: {
        matchId,
        senderId,
        content,
        mediaUrl,
        mediaType,
        isEphemeral,
        metadata: metadata || null,
      },
    });

    const recipientId = match.user1Id === senderId ? match.user2Id : match.user1Id;
    const senderUser = match.user1Id === senderId ? match.user1 : match.user2;

    return {
      ...message,
      recipientId,
      sender: {
        id: senderUser.id,
        name: senderUser.profile?.name || 'Someone',
        photo: senderUser.photos?.[0]?.url || null,
      },
    };
  }

  async getHistory(matchId: string, cursor?: string, limitStr?: string) {
    const limit = Math.min(Math.max(parseInt(limitStr || '30', 10) || 30, 1), 100);

    const messages = await this.prisma.message.findMany({
      where: { matchId },
      orderBy: { sentAt: 'desc' },
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
    });

    const hasMore = messages.length > limit;
    const items = hasMore ? messages.slice(0, limit) : messages;
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : null;

    return {
      items: [...items].reverse(),
      nextCursor,
      hasMore,
    };
  }

  async respondDateInvite(
    matchId: string,
    messageId: string,
    userId: string,
    response: 'accepted' | 'declined',
  ) {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message || message.matchId !== matchId) {
      throw new NotFoundException('Date invitation not found');
    }

    const existingMeta = (message.metadata as any) || {};
    const updatedMeta = {
      ...existingMeta,
      status: response,
      respondedBy: userId,
      respondedAt: new Date().toISOString(),
    };

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { metadata: updatedMeta },
    });

    return updated;
  }

  async viewEphemeralMedia(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.isEphemeral && !message.viewedAt && message.senderId !== userId) {
      return this.prisma.message.update({
        where: { id: messageId },
        data: {
          viewedAt: new Date(),
        },
      });
    }

    return message;
  }

  async isParticipant(matchId: string, userId: string): Promise<boolean> {
    if (!matchId || !userId) return false;
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { user1Id: true, user2Id: true },
    });
    return Boolean(match && (match.user1Id === userId || match.user2Id === userId));
  }

  async markMessagesAsRead(matchId: string, readerUserId: string): Promise<Date> {
    const now = new Date();
    await this.prisma.message.updateMany({
      where: {
        matchId,
        senderId: { not: readerUserId },
        readAt: null,
      },
      data: {
        readAt: now,
      },
    });
    return now;
  }

  async clearMessages(matchId: string, userId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match || (match.user1Id !== userId && match.user2Id !== userId)) {
      throw new ForbiddenException('Not part of this match');
    }

    await this.prisma.message.deleteMany({
      where: { matchId },
    });

    return { success: true };
  }
}
