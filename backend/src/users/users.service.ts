import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: {
          include: {
            prompts: { orderBy: { order: 'asc' } },
          },
        },
        photos: { orderBy: { order: 'asc' }, take: 6 },
      },
    });
  }

  async upsertProfile(userId: string, dto: UpdateProfileDto) {
    const { isIncognito, ...profileData } = dto;
    const incognitoMode =
      dto.incognitoMode !== undefined
        ? dto.incognitoMode
        : isIncognito !== undefined
        ? isIncognito
        : undefined;

    const existingProfile = await this.prisma.profile.findUnique({ where: { userId } });

    const updateData: Record<string, any> = {
      ...profileData,
    };
    if (incognitoMode !== undefined) {
      updateData.incognitoMode = incognitoMode;
    }
    if (dto.dob) {
      const parsed = new Date(dto.dob);
      if (!isNaN(parsed.getTime())) {
        updateData.dob = parsed;
      }
    }

    if (existingProfile) {
      return this.prisma.profile.update({
        where: { userId },
        data: updateData,
        include: {
          prompts: { orderBy: { order: 'asc' } },
        },
      });
    }

    const defaultDob =
      dto.dob && !isNaN(new Date(dto.dob).getTime())
        ? new Date(dto.dob)
        : new Date('2000-01-01T00:00:00.000Z');

    return this.prisma.profile.create({
      data: {
        userId,
        name: dto.name || 'User',
        dob: defaultDob,
        gender: dto.gender || 'MALE',
        interestedIn: dto.interestedIn || ['FEMALE'],
        ...updateData,
      },
      include: {
        prompts: { orderBy: { order: 'asc' } },
      },
    });
  }

  async addOrUpdatePrompt(userId: string, question: string, answer: string, order = 0) {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    const existing = await this.prisma.profilePrompt.findFirst({
      where: { profileId: profile.id, question },
    });

    if (existing) {
      return this.prisma.profilePrompt.update({
        where: { id: existing.id },
        data: { answer, order },
      });
    }

    return this.prisma.profilePrompt.create({
      data: {
        profileId: profile.id,
        question,
        answer,
        order,
      },
    });
  }

  async deletePrompt(userId: string, promptId: string) {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    await this.prisma.profilePrompt.deleteMany({
      where: { id: promptId, profileId: profile.id },
    });

    return { success: true };
  }

  async getPublicProfile(targetUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: {
        profile: {
          include: {
            prompts: { orderBy: { order: 'asc' } },
          },
        },
        photos: { orderBy: { order: 'asc' } },
      },
    });

    if (!user || !user.profile) {
      throw new NotFoundException('User profile not found');
    }

    return {
      id: user.id,
      name: user.profile.name,
      dob: user.profile.dob,
      gender: user.profile.gender,
      bio: user.profile.bio,
      isVerified: user.profile.isVerified,
      interests: user.profile.interests,
      voiceBioUrl: user.profile.voiceBioUrl,
      twoTruths: user.profile.twoTruths,
      prompts: user.profile.prompts,
      photos: user.photos,
    };
  }

  async updateVoiceBio(userId: string, voiceBioUrl: string | null) {
    const profile = await this.prisma.profile.update({
      where: { userId },
      data: { voiceBioUrl },
    });
    return { success: true, voiceBioUrl: profile.voiceBioUrl };
  }
}

