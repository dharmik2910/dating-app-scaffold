import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatGateway } from '../chat/chat.gateway';

@Injectable()
export class DiscoveryService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => ChatGateway))
    private chatGateway: ChatGateway,
  ) {}

  async getCandidates(
    userId: string,
    cursor?: string,
    limitStr?: string,
    query?: string,
  ) {
    const limit = Math.min(Math.max(parseInt(limitStr || '15', 10) || 15, 1), 50);

    // 1. Fetch user's swipes and blocks
    const [swiped, myBlocks, blocksOnMe] = await Promise.all([
      this.prisma.swipe.findMany({
        where: { swiperId: userId },
        select: { swipedId: true, action: true },
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

    const blockedSet = new Set([
      ...myBlocks.map((b) => b.blockedId),
      ...blocksOnMe.map((b) => b.blockerId),
    ]);

    const swipedUserIds = new Set(swiped.map((s) => s.swipedId));
    const excludedUserIds = Array.from(blockedSet);

    // 2. Fetch current user profile (with passport check)
    const me = await this.prisma.profile.findUnique({
      where: { userId },
      include: { prompts: true },
    });

    const usePassport = me?.passportActive && me?.passportLat && me?.passportLng;
    const meLat = usePassport ? (me.passportLat as number) : me?.latitude ?? 0;
    const meLng = usePassport ? (me.passportLng as number) : me?.longitude ?? 0;

    const trimmedQuery = query?.trim();
    const whereClause: any = {
      userId: {
        not: userId,
        notIn: excludedUserIds,
      },
      user: {
        isBanned: false,
      },
    };

    if (trimmedQuery) {
      whereClause.OR = [
        { name: { contains: trimmedQuery, mode: 'insensitive' } },
        { bio: { contains: trimmedQuery, mode: 'insensitive' } },
      ];
    }

    const profiles = await this.prisma.profile.findMany({
      where: whereClause,
      include: {
        prompts: { orderBy: { order: 'asc' } },
        user: {
          include: {
            photos: {
              orderBy: { order: 'asc' },
              take: 6,
            },
            swipesGiven: {
              where: { swipedId: userId, action: { in: ['LIKE', 'SUPERLIKE'] } },
            },
          },
        },
      },
      take: limit + 10, // extra to filter incognito
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      orderBy: [{ boostedUntil: 'desc' }, { updatedAt: 'desc' }],
    });

    // 3. Obey Incognito mode: if profile has incognitoMode=true, only show if they swiped right on me
    const visibleProfiles = profiles.filter((p) => {
      if (p.incognitoMode) {
        return p.user.swipesGiven.length > 0;
      }
      return true;
    });

    const hasMore = visibleProfiles.length > limit;
    const rawItems = hasMore ? visibleProfiles.slice(0, limit) : visibleProfiles;
    const nextCursor =
      hasMore && rawItems.length > 0 ? rawItems[rawItems.length - 1].id : null;

    const now = new Date();
    const items = rawItems.map((p) => {
      let distanceKm = 0;
      if (meLat && meLng && p.latitude && p.longitude) {
        const radLat1 = (Math.PI * meLat) / 180;
        const radLat2 = (Math.PI * p.latitude) / 180;
        const theta = meLng - p.longitude;
        const radTheta = (Math.PI * theta) / 180;
        let dist =
          Math.sin(radLat1) * Math.sin(radLat2) +
          Math.cos(radLat1) * Math.cos(radLat2) * Math.cos(radTheta);
        dist = Math.min(1, Math.max(-1, dist));
        dist = Math.acos(dist);
        dist = (dist * 180) / Math.PI;
        dist = dist * 60 * 1.1515 * 1.609344;
        distanceKm = Math.round(dist * 10) / 10;
      }

      const isOnline = this.chatGateway ? this.chatGateway.isUserOnline(p.userId) : false;
      const liveLastActive = this.chatGateway
        ? this.chatGateway.getLastActive(p.userId)
        : null;
      const isBoosted = Boolean(p.boostedUntil && new Date(p.boostedUntil) > now);

      return {
        id: p.id,
        userId: p.userId,
        name: p.name,
        bio: p.bio,
        gender: p.gender,
        latitude: p.latitude,
        longitude: p.longitude,
        distance_km: distanceKm,
        liked: swipedUserIds.has(p.userId),
        photos: p.user.photos || [],
        isVerified: p.isVerified,
        interests: p.interests || [],
        voiceBioUrl: p.voiceBioUrl || null,
        twoTruths: p.twoTruths || null,
        prompts: p.prompts || [],
        isBoosted,
        isOnline,
        lastActiveAt: liveLastActive ? liveLastActive.toISOString() : p.updatedAt,
      };
    });

    return {
      items,
      nextCursor,
      hasMore,
    };
  }

  async getTopPicks(userId: string) {
    const candidates = await this.getCandidates(userId, undefined, '8');
    return candidates.items.map((item, idx) => ({
      ...item,
      topPickReason:
        idx === 0
          ? '🌟 96% Match • Shared Passions'
          : idx === 1
          ? '🔥 Trending Today • High Chemistry'
          : idx === 2
          ? '🛡️ Verified Active • Great Conversationalist'
          : '✨ Curated for You',
    }));
  }

  async getBlindDateQueue(userId: string) {
    const candidates = await this.getCandidates(userId, undefined, '6');
    return candidates.items.map((item) => ({
      ...item,
      blindMode: true,
      hint: `${item.gender === 'female' ? 'Woman' : 'Man'} • Loves ${
        (item.interests && item.interests[0]) || 'Music & Travel'
      }`,
    }));
  }
}
