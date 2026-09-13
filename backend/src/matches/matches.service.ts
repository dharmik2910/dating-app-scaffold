import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatGateway } from '../chat/chat.gateway';

@Injectable()
export class MatchesService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => ChatGateway))
    private chatGateway: ChatGateway,
  ) {}

  async listForUser(
    userId: string,
    cursor?: string,
    limitStr?: string,
    type: 'matches' | 'conversations' | 'all' = 'matches',
  ) {
    const limit = Math.min(Math.max(parseInt(limitStr || '20', 10) || 20, 1), 50);

    // Get current user's active likes and blocks
    const [userSwipes, myBlocks, blocksOnMe] = await Promise.all([
      this.prisma.swipe.findMany({
        where: {
          swiperId: userId,
          action: { in: ['LIKE', 'SUPERLIKE'] },
        },
        select: { swipedId: true },
      }),
      this.prisma.block.findMany({
        where: { blockerId: userId },
        select: { blockedId: true },
      }),
      this.prisma.block.findMany({
        where: { blockedId: userId },
        select: { blockerId: true },
      }),
    ]);

    const activeLikedUserIds = new Set(userSwipes.map((s) => s.swipedId));
    const blockedSet = new Set([
      ...myBlocks.map((b) => b.blockedId),
      ...blocksOnMe.map((b) => b.blockerId),
    ]);

    const matches = await this.prisma.match.findMany({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }],
        AND: [
          { user1Id: { notIn: Array.from(blockedSet) } },
          { user2Id: { notIn: Array.from(blockedSet) } },
          { user1: { isBanned: false } },
          { user2: { isBanned: false } },
        ],
      },
      include: {
        user1: {
          include: {
            profile: { include: { prompts: true } },
            photos: { take: 1, orderBy: { order: 'asc' } },
          },
        },
        user2: {
          include: {
            profile: { include: { prompts: true } },
            photos: { take: 1, orderBy: { order: 'asc' } },
          },
        },
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
      if (blockedSet.has(other.id)) return false;

      const isActiveMatch = activeLikedUserIds.has(other.id);
      const hasChatHistory = m.messages && m.messages.length > 0;

      if (type === 'conversations') {
        return isActiveMatch || hasChatHistory;
      }
      if (type === 'matches') {
        return isActiveMatch;
      }
      return true;
    });

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
    const nextCursor =
      hasMore && rawItems.length > 0 ? rawItems[rawItems.length - 1].id : null;

    const items = rawItems.map((m) => {
      const other = m.user1Id === userId ? m.user2 : m.user1;
      const otherId = other?.id || '';
      const isUnmatched = !activeLikedUserIds.has(otherId);
      const isOnline =
        otherId && this.chatGateway ? this.chatGateway.isUserOnline(otherId) : false;
      const liveLastActive =
        otherId && this.chatGateway ? this.chatGateway.getLastActive(otherId) : null;
      const fallbackLastActive = other?.profile?.updatedAt || other?.updatedAt;

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
          isVerified: other?.profile?.isVerified || false,
          interests: other?.profile?.interests || [],
          voiceBioUrl: other?.profile?.voiceBioUrl || null,
          twoTruths: other?.profile?.twoTruths || null,
          prompts: other?.profile?.prompts || [],
          latitude: other?.profile?.latitude,
          longitude: other?.profile?.longitude,
          updatedAt: fallbackLastActive,
          isOnline,
          lastActiveAt: liveLastActive
            ? liveLastActive.toISOString()
            : fallbackLastActive,
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
