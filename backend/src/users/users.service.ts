import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  getProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true, photos: { orderBy: { order: 'asc' } } },
    });
  }

  upsertProfile(userId: string, dto: UpdateProfileDto) {
    return this.prisma.profile.upsert({
      where: { userId },
      update: { ...dto, dob: new Date(dto.dob) },
      create: { ...dto, userId, dob: new Date(dto.dob) },
    });
  }
}
