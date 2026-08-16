import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MatchesService {
  constructor(private prisma: PrismaService) {}

  async listForUser(userId: string, cursor?: string, limitStr?: string) {
    const limit = Math.min(Math.max(parseInt(limitStr || '20', 10) || 20, 1), 50);

    const matches = await this.prisma.match.findMany({
      where: { OR: [{ user1Id: userId }, { user2Id: userId }] },
      include: {
        user1: { include: { profile: true, photos: { take: 1, orderBy: { order: 'asc' } } } },
        user2: { include: { profile: true, photos: { take: 1, orderBy: { order: 'asc' } } } },
        messages: { orderBy: { sentAt: 'desc' }, take: 1 },
      },
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      orderBy: { matchedAt: 'desc' },
    });

    const hasMore = matches.length > limit;
    const rawItems = hasMore ? matches.slice(0, limit) : matches;
    const nextCursor = hasMore && rawItems.length > 0 ? rawItems[rawItems.length - 1].id : null;

    const items = rawItems.map((m) => {
      const other = m.user1Id === userId ? m.user2 : m.user1;
      return {
        id: m.id,
        matchedAt: m.matchedAt,
        messages: m.messages,
        otherUser: {
          id: other?.id,
          name: other?.profile?.name || 'User',
          photos: other?.photos || [],
        },
      };
    });

    return {
      items,
      nextCursor,
      hasMore,
    };
  }
}
