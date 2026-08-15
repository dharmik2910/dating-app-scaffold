import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  async saveMessage(matchId: string, senderId: string, content: string) {
    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (!match || (match.user1Id !== senderId && match.user2Id !== senderId)) {
      throw new ForbiddenException('Not part of this match');
    }
    return this.prisma.message.create({ data: { matchId, senderId, content } });
  }

  getHistory(matchId: string) {
    return this.prisma.message.findMany({ where: { matchId }, orderBy: { sentAt: 'asc' } });
  }
}
