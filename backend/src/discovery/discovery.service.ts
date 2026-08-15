import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DiscoveryService {
  constructor(private prisma: PrismaService) { }

  async getCandidates(userId: string, limit = 50) {
    const swiped = await this.prisma.swipe.findMany({
      where: { swiperId: userId },
      select: { swipedId: true, action: true },
    });
    const swipedIds = swiped.map((s) => s.swipedId);
    const likedSet = new Set(
      swiped.filter((s) => s.action === 'LIKE' || s.action === 'SUPERLIKE').map((s) => s.swipedId)
    );

    const me = await this.prisma.profile.findUnique({ where: { userId } });
    const meLat = me?.latitude ?? 0;
    const meLng = me?.longitude ?? 0;

    const profiles = await this.prisma.profile.findMany({
      where: {
        userId: {
          not: userId,
        },
      },
      include: {
        user: {
          include: {
            photos: {
              orderBy: { order: 'asc' },
            },
          },
        },
      },
      take: limit,
      orderBy: { updatedAt: 'desc' },
    });

    return profiles.map((p) => {
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

      return {
        userId: p.userId,
        name: p.name,
        bio: p.bio,
        gender: p.gender,
        distance_km: distanceKm,
        liked: likedSet.has(p.userId),
        photos: p.user.photos || [],
      };
    });
  }
}




