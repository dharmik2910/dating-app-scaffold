import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  async saveMessage(matchId: string, senderId: string, content: string) {
    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (!match || (match.user1Id !== senderId && match.user2Id !== senderId)) {
      throw new ForbiddenException('Not part of this match');
    }
    return this.prisma.message.create({ data: { matchId, senderId, content } });
  }

  async getHistory(matchId: string, cursor?: string, limitStr?: string) {
    const limit = Math.min(Math.max(parseInt(limitStr || '25', 10) || 25, 1), 100);

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
}
