import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MatchesService {
  constructor(private prisma: PrismaService) { }

  async listForUser(
    userId: string,
    cursor?: string,
    limitStr?: string,
    type: 'matches' | 'conversations' | 'all' = 'matches',
  ) {
    const limit = Math.min(Math.max(parseInt(limitStr || '20', 10) || 20, 1), 50);

    // Get current user's active likes
    const userSwipes = await this.prisma.swipe.findMany({
      where: {
        swiperId: userId,
        action: { in: ['LIKE', 'SUPERLIKE'] },
      },
      select: { swipedId: true },
    });
    const activeLikedUserIds = new Set(userSwipes.map((s) => s.swipedId));

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

    const filtered = matches.filter((m) => {
      const other = m.user1Id === userId ? m.user2 : m.user1;
      if (!other) return false;
      const isActiveMatch = activeLikedUserIds.has(other.id);
      const hasChatHistory = m.messages && m.messages.length > 0;

      if (type === 'conversations') {
        // Chat inbox: show active matches OR any conversation with chat messages
        return isActiveMatch || hasChatHistory;
      }
      if (type === 'matches') {
        // Matches page: show ONLY active matches (not removed/unmatched)
        return isActiveMatch;
      }
      return true;
    });

    // Sort: Most recent message sentAt (or matchedAt) on top like WhatsApp
    filtered.sort((a, b) => {
      const aTime = a.messages?.[0]?.sentAt
        ? new Date(a.messages[0].sentAt).getTime()
        : new Date(a.matchedAt).getTime();
      const bTime = b.messages?.[0]?.sentAt
        ? new Date(b.messages[0].sentAt).getTime()
        : new Date(b.matchedAt).getTime();
      return bTime - aTime;
    });

    const hasMore = filtered.length > limit;
    const rawItems = hasMore ? filtered.slice(0, limit) : filtered;
    const nextCursor = hasMore && rawItems.length > 0 ? rawItems[rawItems.length - 1].id : null;

    const items = rawItems.map((m) => {
      const other = m.user1Id === userId ? m.user2 : m.user1;
      const isUnmatched = !activeLikedUserIds.has(other?.id || '');
      return {
        id: m.id,
        matchedAt: m.matchedAt,
        messages: m.messages,
        isUnmatched,
        otherUser: {
          id: other?.id,
          name: other?.profile?.name || 'User',
          photos: other?.photos || [],
          bio: other?.profile?.bio,
          latitude: other?.profile?.latitude,
          longitude: other?.profile?.longitude,
          updatedAt: other?.profile?.updatedAt || other?.updatedAt,
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
