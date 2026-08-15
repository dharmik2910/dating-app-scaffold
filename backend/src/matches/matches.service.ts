import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MatchesService {
  constructor(private prisma: PrismaService) {}

  async listForUser(userId: string) {
    const matches = await this.prisma.match.findMany({
      where: { OR: [{ user1Id: userId }, { user2Id: userId }] },
      include: {
        user1: { include: { profile: true, photos: { take: 1, orderBy: { order: 'asc' } } } },
        user2: { include: { profile: true, photos: { take: 1, orderBy: { order: 'asc' } } } },
        messages: { orderBy: { sentAt: 'desc' }, take: 1 },
      },
      orderBy: { matchedAt: 'desc' },
    });

    return matches.map((m) => {
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
  }
}
