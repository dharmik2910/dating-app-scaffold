import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const DAILY_FREE_SWIPES = 10;

@Injectable()
export class SwipesService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async getSwipeQuota(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { boostedUntil: true },
    });

    const isVip = Boolean(profile?.boostedUntil && new Date(profile.boostedUntil) > new Date());
    if (isVip) {
      return { remaining: 9999, isUnlimited: true, totalAllowed: 9999, swipesToday: 0 };
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const swipesToday = await this.prisma.swipe.count({
      where: {
        swiperId: userId,
        createdAt: { gte: startOfDay },
      },
    });

    const remaining = Math.max(0, DAILY_FREE_SWIPES - swipesToday);
    return {
      remaining,
      isUnlimited: false,
      totalAllowed: DAILY_FREE_SWIPES,
      swipesToday,
    };
  }

  async swipe(
    swiperId: string,
    swipedId: string,
    action: 'LIKE' | 'PASS' | 'SUPERLIKE' | 'UNLIKE',
    comment?: string,
  ) {
    if (swiperId === swipedId) {
      throw new BadRequestException('You cannot swipe on yourself');
    }

    if (action === 'UNLIKE') {
      await this.prisma.swipe.deleteMany({
        where: { swiperId, swipedId },
      });

      const [u1, u2] = [swiperId, swipedId].sort();
      await this.prisma.match.deleteMany({
        where: { user1Id: u1, user2Id: u2 },
      });

      const quota = await this.getSwipeQuota(swiperId);
      return {
        matched: false,
        unliked: true,
        quota,
      };
    }

    // Check if user has already swiped on this profile
    const existingSwipe = await this.prisma.swipe.findUnique({
      where: { swiperId_swipedId: { swiperId, swipedId } },
    });

    if (existingSwipe) {
      const quota = await this.getSwipeQuota(swiperId);
      return {
        matched: existingSwipe.action === 'LIKE' || existingSwipe.action === 'SUPERLIKE',
        alreadySwiped: true,
        quota,
      };
    }

    // Check daily quota (10 swipes per day)
    const quota = await this.getSwipeQuota(swiperId);
    if (!quota.isUnlimited && quota.remaining <= 0) {
      throw new BadRequestException(
        'You have reached your limit of 10 swipes for today. No more swipes allowed!',
      );
    }

    await this.prisma.swipe.upsert({
      where: { swiperId_swipedId: { swiperId, swipedId } },
      update: { action, comment },
      create: { swiperId, swipedId, action, comment },
    });

    // Fetch swiper profile for notifications
    const swiperProfile = await this.prisma.profile.findUnique({
      where: { userId: swiperId },
      select: { name: true },
    });
    const swiperName = swiperProfile?.name || 'Someone';

    if (comment) {
      await this.prisma.compliment.create({
        data: {
          senderId: swiperId,
          receiverId: swipedId,
          content: comment,
          targetType: 'profile',
        },
      });

      // Send compliment notification
      await this.notificationsService.createNotification(
        swipedId,
        'COMPLIMENT',
        '💬 New Compliment Received!',
        `${swiperName} sent you a compliment: "${comment}"`,
        { senderId: swiperId, compliment: comment },
      );
    } else if (action === 'SUPERLIKE') {
      await this.notificationsService.createNotification(
        swipedId,
        'SUPER_LIKE',
        '⭐ You received a Super Like!',
        `${swiperName} super liked your profile!`,
        { senderId: swiperId },
      );
    }

    if (action === 'PASS') {
      const quotaAfter = await this.getSwipeQuota(swiperId);
      return { matched: false, quota: quotaAfter };
    }

    // Auto-create reciprocal swipe for demo & instant match creation
    await this.prisma.swipe.upsert({
      where: { swiperId_swipedId: { swiperId: swipedId, swipedId: swiperId } },
      update: { action: 'LIKE' },
      create: { swiperId: swipedId, swipedId: swiperId, action: 'LIKE' },
    });

    const [user1Id, user2Id] = [swiperId, swipedId].sort();
    const match = await this.prisma.match.upsert({
      where: { user1Id_user2Id: { user1Id, user2Id } },
      update: {},
      create: { user1Id, user2Id },
      include: {
        user1: { include: { profile: true } },
        user2: { include: { profile: true } },
      },
    });

    // Send Match Notification to both users
    const user1Name = match.user1.profile?.name || 'Your Match';
    const user2Name = match.user2.profile?.name || 'Your Match';

    await Promise.all([
      this.notificationsService.createNotification(
        user1Id,
        'NEW_MATCH',
        '🎉 It\'s a Match!',
        `You and ${user2Name} liked each other! Start the conversation now.`,
        { matchId: match.id, otherUserId: user2Id, otherUserName: user2Name },
      ),
      this.notificationsService.createNotification(
        user2Id,
        'NEW_MATCH',
        '🎉 It\'s a Match!',
        `You and ${user1Name} liked each other! Start the conversation now.`,
        { matchId: match.id, otherUserId: user1Id, otherUserName: user1Name },
      ),
    ]);

    const quotaAfter = await this.getSwipeQuota(swiperId);
    return { matched: true, match, quota: quotaAfter };
  }

  async getWhoLikedMe(userId: string) {
    // Find who liked the user
    const inboundLikes = await this.prisma.swipe.findMany({
      where: {
        swipedId: userId,
        action: { in: ['LIKE', 'SUPERLIKE'] },
      },
      include: {
        swiper: {
          include: {
            profile: { include: { prompts: true } },
            photos: { orderBy: { order: 'asc' } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Find who current user has already swiped on
    const mySwipes = await this.prisma.swipe.findMany({
      where: { swiperId: userId },
      select: { swipedId: true },
    });
    const swipedUserIds = new Set(mySwipes.map((s) => s.swipedId));

    // Filter out users already swiped on (keep un-actioned likes)
    const pendingLikes = inboundLikes.filter((l) => !swipedUserIds.has(l.swiperId));

    return pendingLikes.map((l) => {
      const p = l.swiper.profile;
      return {
        swipeId: l.id,
        swiperId: l.swiperId,
        action: l.action,
        comment: l.comment,
        createdAt: l.createdAt,
        user: {
          id: l.swiper.id,
          name: p?.name || 'Admirer',
          bio: p?.bio || '',
          gender: p?.gender || 'other',
          isVerified: p?.isVerified || false,
          interests: p?.interests || [],
          voiceBioUrl: p?.voiceBioUrl || null,
          twoTruths: p?.twoTruths || null,
          prompts: p?.prompts || [],
          photos: l.swiper.photos || [],
        },
      };
    });
  }

  async boost(userId: string, durationMinutes = 30) {
    const boostUntil = new Date(Date.now() + durationMinutes * 60 * 1000);
    const profile = await this.prisma.profile.update({
      where: { userId },
      data: { boostedUntil: boostUntil },
    });

    return {
      success: true,
      boostedUntil: profile.boostedUntil,
      remainingMinutes: durationMinutes,
    };
  }

  async compliment(
    senderId: string,
    receiverId: string,
    content: string,
    targetType = 'profile',
    targetId?: string,
  ) {
    if (senderId === receiverId) {
      throw new BadRequestException('You cannot compliment yourself');
    }

    const compliment = await this.prisma.compliment.create({
      data: {
        senderId,
        receiverId,
        content,
        targetType,
        targetId,
      },
    });

    // Send a SUPERLIKE with the compliment attached
    const swipeResult = await this.swipe(senderId, receiverId, 'SUPERLIKE', content);

    return {
      success: true,
      compliment,
      ...swipeResult,
    };
  }
}

