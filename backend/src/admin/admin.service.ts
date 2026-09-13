import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async getStats() {
    const [
      totalUsers,
      verifiedUsers,
      bannedUsers,
      totalMatches,
      totalSwipes,
      pendingReports,
      totalSafeDates,
      activeBoosts,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.profile.count({ where: { isVerified: true } }),
      this.prisma.user.count({ where: { isBanned: true } }),
      this.prisma.match.count(),
      this.prisma.swipe.count(),
      this.prisma.report.count({ where: { status: 'PENDING' } }),
      this.prisma.safeDate.count(),
      this.prisma.profile.count({
        where: { boostedUntil: { gt: new Date() } },
      }),
    ]);

    return {
      totalUsers,
      verifiedUsers,
      bannedUsers,
      totalMatches,
      totalSwipes,
      pendingReports,
      totalSafeDates,
      activeBoosts,
      systemHealth: 'OPERATIONAL',
      serverTime: new Date().toISOString(),
    };
  }

  async broadcastAnnouncement(title: string, body: string, data?: any) {
    const users = await this.prisma.user.findMany({ select: { id: true } });
    const tasks = users.map((u) =>
      this.notificationsService.createNotification(
        u.id,
        'SYSTEM',
        `📢 ${title}`,
        body,
        data || {},
      ),
    );
    await Promise.all(tasks);
    return { success: true, count: users.length };
  }

  async getStories() {
    return this.prisma.story.findMany({
      include: {
        user: {
          include: {
            profile: true,
            photos: { take: 1, orderBy: { order: 'asc' } },
          },
        },
        _count: { select: { views: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async deleteStory(storyId: string) {
    await this.prisma.story.deleteMany({ where: { id: storyId } });
    return { success: true };
  }

  async getUsers(
    search?: string,
    verifiedOnly?: boolean,
    limitStr?: string,
    statusFilter?: string,
  ) {
    const limit = Math.min(Math.max(parseInt(limitStr || '50', 10) || 50, 1), 100);

    const where: any = {};
    if (verifiedOnly) {
      where.profile = { isVerified: true };
    }
    if (statusFilter === 'BANNED') {
      where.isBanned = true;
    } else if (statusFilter === 'ACTIVE') {
      where.isBanned = false;
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { phone: { contains: q, mode: 'insensitive' } },
        { profile: { name: { contains: q, mode: 'insensitive' } } },
        { profile: { bio: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const users = await this.prisma.user.findMany({
      where,
      include: {
        profile: { include: { prompts: true } },
        photos: { orderBy: { order: 'asc' }, take: 3 },
        _count: {
          select: {
            matchesA: true,
            matchesB: true,
            reportsReceived: true,
            swipesGiven: true,
          },
        },
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    return users.map((u: any) => ({
      id: u.id,
      phone: u.phone,
      createdAt: u.createdAt,
      isBanned: Boolean(u.isBanned),
      banReason: u.banReason || null,
      name: u.profile?.name || 'Unnamed',
      gender: u.profile?.gender || 'other',
      bio: u.profile?.bio || '',
      isVerified: Boolean(u.profile?.isVerified),
      interests: u.profile?.interests || [],
      passportActive: Boolean(u.profile?.passportActive),
      passportCity: u.profile?.passportCity || null,
      incognitoMode: Boolean(u.profile?.incognitoMode),
      boostedUntil: u.profile?.boostedUntil || null,
      photos: u.photos,
      matchCount: (u._count?.matchesA || 0) + (u._count?.matchesB || 0),
      reportsCount: u._count?.reportsReceived || 0,
      swipesCount: u._count?.swipesGiven || 0,
    }));
  }

  async toggleVerifyUser(userId: string, isVerified?: boolean) {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Profile not found');

    const newStatus = isVerified !== undefined ? isVerified : !profile.isVerified;
    return this.prisma.profile.update({
      where: { userId },
      data: { isVerified: newStatus },
    });
  }

  async toggleBanUser(userId: string, isBanned: boolean, banReason?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        isBanned,
        banReason: isBanned ? banReason || 'Violation of Community Guidelines' : null,
      },
    });

    return {
      success: true,
      isBanned: Boolean(updated.isBanned),
      banReason: updated.banReason,
      userId: updated.id,
    };
  }

  async deleteUser(userId: string) {
    return this.prisma.user.delete({ where: { id: userId } });
  }

  async getReports(status?: string) {
    return this.prisma.report.findMany({
      where: status ? { status } : undefined,
      include: {
        reporter: {
          include: {
            profile: true,
            photos: { take: 1, orderBy: { order: 'asc' } },
          },
        },
        reported: {
          include: {
            profile: true,
            photos: { take: 3, orderBy: { order: 'asc' } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateReportStatus(reportId: string, status: string) {
    return this.prisma.report.update({
      where: { id: reportId },
      data: { status },
    });
  }

  async getSafeDates() {
    return this.prisma.safeDate.findMany({
      include: {
        user: {
          include: {
            profile: true,
            photos: { take: 1, orderBy: { order: 'asc' } },
          },
        },
        match: {
          include: {
            user1: { include: { profile: true, photos: { take: 1 } } },
            user2: { include: { profile: true, photos: { take: 1 } } },
          },
        },
      },
      orderBy: { scheduledTime: 'desc' },
    });
  }
}

