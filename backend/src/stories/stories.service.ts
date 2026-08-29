import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatGateway } from '../chat/chat.gateway';
import { S3Service } from '../photos/s3.service';

@Injectable()
export class StoriesService {
  constructor(
    private prisma: PrismaService,
    private chatGateway: ChatGateway,
    private s3: S3Service,
  ) {}

  async uploadStoryMedia(userId: string, file: any) {
    const { publicUrl, key } = await this.s3.uploadBuffer(
      userId,
      file.buffer,
      file.mimetype,
      'stories',
    );
    return { mediaUrl: publicUrl, key };
  }

  async getFeed(currentUserId: string) {
    const now = new Date();

    // Fetch non-expired stories
    const activeStories = await this.prisma.story.findMany({
      where: {
        expiresAt: {
          gt: now,
        },
      },
      include: {
        user: {
          include: {
            profile: true,
            photos: {
              orderBy: { order: 'asc' },
              take: 1,
            },
          },
        },
        views: {
          where: {
            viewerId: currentUserId,
          },
        },
        _count: {
          select: { views: true },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Group stories by user
    const userMap = new Map<string, any>();

    for (const story of activeStories) {
      const uId = story.userId;
      const isOwner = uId === currentUserId;
      const viewed = story.views.length > 0;

      if (!userMap.has(uId)) {
        userMap.set(uId, {
          userId: uId,
          userName: story.user?.profile?.name || 'User',
          userPhoto: story.user?.photos?.[0]?.url || null,
          isSelf: isOwner,
          hasUnseen: false,
          latestCreatedAt: story.createdAt,
          stories: [],
        });
      }

      const userEntry = userMap.get(uId)!;
      if (!viewed && !isOwner) {
        userEntry.hasUnseen = true;
      }
      if (new Date(story.createdAt) > new Date(userEntry.latestCreatedAt)) {
        userEntry.latestCreatedAt = story.createdAt;
      }

      userEntry.stories.push({
        id: story.id,
        userId: story.userId,
        mediaUrl: story.mediaUrl,
        mediaType: story.mediaType,
        caption: story.caption,
        createdAt: story.createdAt,
        expiresAt: story.expiresAt,
        viewed: viewed || isOwner,
        viewCount: story._count?.views || 0,
      });
    }

    const groups = Array.from(userMap.values());

    // Sort: current user first, then users with unseen stories, then latest created
    groups.sort((a, b) => {
      if (a.isSelf) return -1;
      if (b.isSelf) return 1;
      if (a.hasUnseen && !b.hasUnseen) return -1;
      if (!a.hasUnseen && b.hasUnseen) return 1;
      return new Date(b.latestCreatedAt).getTime() - new Date(a.latestCreatedAt).getTime();
    });

    return groups;
  }

  async createStory(userId: string, mediaUrl: string, mediaType = 'image', caption?: string) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    const story = await this.prisma.story.create({
      data: {
        userId,
        mediaUrl,
        mediaType,
        caption: caption?.trim() || null,
        createdAt: now,
        expiresAt,
      },
    });

    // Broadcast real-time storyCreated event to all connected clients
    try {
      this.chatGateway.server?.emit('storyCreated', {
        userId,
        storyId: story.id,
      });
    } catch (e) {
      console.error('Failed to emit storyCreated socket event:', e);
    }

    return story;
  }

  async markViewed(storyId: string, viewerId: string) {
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
    });

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    // Do not record self view
    if (story.userId === viewerId) {
      return { success: true, selfView: true };
    }

    // Upsert view
    await this.prisma.storyView.upsert({
      where: {
        storyId_viewerId: {
          storyId,
          viewerId,
        },
      },
      create: {
        storyId,
        viewerId,
      },
      update: {},
    });

    // Real-time notify the story owner that their story was viewed
    try {
      this.chatGateway.server?.to(`user:${story.userId}`).emit('storyViewed', {
        storyId,
        viewerId,
      });
    } catch (e) {
      console.error('Failed to emit storyViewed socket event:', e);
    }

    return { success: true };
  }

  async deleteStory(storyId: string, userId: string) {
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
    });

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    if (story.userId !== userId) {
      throw new ForbiddenException('You can only delete your own stories');
    }

    await this.prisma.story.delete({
      where: { id: storyId },
    });

    // Broadcast real-time storyDeleted event to all connected clients
    try {
      this.chatGateway.server?.emit('storyDeleted', {
        userId,
        storyId,
      });
    } catch (e) {
      console.error('Failed to emit storyDeleted socket event:', e);
    }

    return { success: true };
  }

  async getStoryViewers(storyId: string, currentUserId: string) {
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
    });

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    if (story.userId !== currentUserId) {
      throw new ForbiddenException('You can only see viewers for your own stories');
    }

    const views = await this.prisma.storyView.findMany({
      where: { storyId },
      include: {
        viewer: {
          include: {
            profile: true,
            photos: {
              orderBy: { order: 'asc' },
              take: 1,
            },
          },
        },
      },
      orderBy: { viewedAt: 'desc' },
    });

    return views.map((v) => ({
      viewerId: v.viewerId,
      viewedAt: v.viewedAt,
      name: v.viewer?.profile?.name || 'User',
      photoUrl: v.viewer?.photos?.[0]?.url || null,
      bio: v.viewer?.profile?.bio || null,
      age: v.viewer?.profile?.dob
        ? Math.floor(
            (new Date().getTime() - new Date(v.viewer.profile.dob).getTime()) /
              (365.25 * 24 * 60 * 60 * 1000),
          )
        : null,
    }));
  }
}
