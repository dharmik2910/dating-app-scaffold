import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SafetyService {
  constructor(private prisma: PrismaService) {}

  async blockUser(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) {
      throw new BadRequestException('You cannot block yourself');
    }

    const block = await this.prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId } },
      update: {},
      create: { blockerId, blockedId },
    });

    // Also remove any active matches and swipes between the two users
    const [u1, u2] = [blockerId, blockedId].sort();
    await this.prisma.match.deleteMany({
      where: { user1Id: u1, user2Id: u2 },
    });
    await this.prisma.swipe.deleteMany({
      where: {
        OR: [
          { swiperId: blockerId, swipedId: blockedId },
          { swiperId: blockedId, swipedId: blockerId },
        ],
      },
    });

    return { success: true, block };
  }

  async unblockUser(blockerId: string, blockedId: string) {
    await this.prisma.block.deleteMany({
      where: { blockerId, blockedId },
    });
    return { success: true };
  }

  async getBlockedUsers(userId: string) {
    const blocks = await this.prisma.block.findMany({
      where: { blockerId: userId },
      include: {
        blocked: {
          include: {
            profile: true,
            photos: { take: 1, orderBy: { order: 'asc' } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return blocks.map((b) => ({
      id: b.id,
      blockedId: b.blockedId,
      name: b.blocked.profile?.name || 'User',
      photo: b.blocked.photos[0]?.url || null,
      createdAt: b.createdAt,
    }));
  }

  async reportUser(reporterId: string, reportedId: string, reason: string, details?: string) {
    if (!reportedId) {
      throw new BadRequestException('Reported user ID is required');
    }
    if (reporterId === reportedId) {
      throw new BadRequestException('You cannot report yourself');
    }

    // Resolve targetUserId whether caller passed User.id or Profile.id
    let targetUserId = reportedId;
    const userExists = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!userExists) {
      const profile = await this.prisma.profile.findUnique({
        where: { id: targetUserId },
      });
      if (profile) {
        targetUserId = profile.userId;
      } else {
        const profileByUser = await this.prisma.profile.findFirst({
          where: { userId: targetUserId },
        });
        if (profileByUser) {
          targetUserId = profileByUser.userId;
        } else {
          throw new NotFoundException('User to report not found');
        }
      }
    }

    const report = await this.prisma.report.create({
      data: {
        reporterId,
        reportedId: targetUserId,
        reason: reason || 'other',
        details: details || '',
        status: 'PENDING',
      },
    });

    return { success: true, reportId: report.id };
  }

  async getReports(status?: string) {
    return this.prisma.report.findMany({
      where: status ? { status } : undefined,
      include: {
        reporter: { include: { profile: true } },
        reported: { include: { profile: true, photos: true } },
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

  async verifyPhoto(userId: string, selfieUrl: string) {
    // In automated mode, save verification selfie and mark profile as verified (blue checkmark)
    const profile = await this.prisma.profile.update({
      where: { userId },
      data: {
        isVerified: true,
        verificationSelfie: selfieUrl,
      },
    });

    return { success: true, isVerified: profile.isVerified };
  }

  async createSafeDate(
    userId: string,
    data: {
      matchId: string;
      contactName: string;
      contactPhone: string;
      locationName: string;
      locationLat?: number;
      locationLng?: number;
      scheduledTime: string;
      notes?: string;
    },
  ) {
    return this.prisma.safeDate.create({
      data: {
        userId,
        matchId: data.matchId,
        contactName: data.contactName,
        contactPhone: data.contactPhone,
        locationName: data.locationName,
        locationLat: data.locationLat,
        locationLng: data.locationLng,
        scheduledTime: new Date(data.scheduledTime),
        notes: data.notes,
        status: 'ACTIVE',
      },
    });
  }

  async getSafeDates(userId: string) {
    return this.prisma.safeDate.findMany({
      where: { userId },
      include: {
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

  async checkInSafeDate(id: string, userId: string, status: 'SAFE' | 'ALERT') {
    const safeDate = await this.prisma.safeDate.findUnique({ where: { id } });
    if (!safeDate || safeDate.userId !== userId) {
      throw new NotFoundException('Safe date plan not found');
    }

    return this.prisma.safeDate.update({
      where: { id },
      data: {
        status,
        checkedInAt: new Date(),
      },
    });
  }
}
