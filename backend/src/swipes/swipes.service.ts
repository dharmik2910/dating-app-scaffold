import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SwipesService {
  constructor(private prisma: PrismaService) {}

  async swipe(swiperId: string, swipedId: string, action: 'LIKE' | 'PASS' | 'SUPERLIKE' | 'UNLIKE') {
    if (action === 'UNLIKE') {
      await this.prisma.swipe.deleteMany({
        where: { swiperId, swipedId },
      });
      const [u1, u2] = [swiperId, swipedId].sort();
      const existingMatch = await this.prisma.match.findUnique({
        where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } },
        include: { _count: { select: { messages: true } } },
      });

      // Only delete the match record completely if no chat messages were ever sent.
      // If messages exist, retain the match so chat history is kept and visible in Chat.
      if (existingMatch && existingMatch._count.messages === 0) {
        await this.prisma.match.deleteMany({
          where: { user1Id: u1, user2Id: u2 },
        });
      }
      return { matched: false, unliked: true };
    }

    await this.prisma.swipe.upsert({
      where: { swiperId_swipedId: { swiperId, swipedId } },
      update: { action },
      create: { swiperId, swipedId, action },
    });

    if (action === 'PASS') return { matched: false };

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
    });

    return { matched: true, match };
  }
}
