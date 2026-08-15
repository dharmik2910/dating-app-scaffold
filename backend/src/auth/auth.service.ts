import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseService } from './firebase.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private firebase: FirebaseService,
    private jwt: JwtService,
  ) {}

  async loginWithFirebaseToken(idToken: string) {
    let decoded;
    try {
      decoded = await this.firebase.verifyIdToken(idToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired Firebase token');
    }

    const { uid, phone_number: phone } = decoded;
    if (!phone) throw new UnauthorizedException('Token missing phone number');

    const user = await this.prisma.user.upsert({
      where: { firebaseUid: uid },
      update: {},
      create: { firebaseUid: uid, phone },
    });

    return this.issueTokens(user.id);
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwt.verify(refreshToken, { secret: process.env.JWT_SECRET });
      return this.issueTokens(payload.sub);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private issueTokens(userId: string) {
    const accessToken = this.jwt.sign({ sub: userId }, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    const refreshToken = this.jwt.sign({ sub: userId }, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' });
    return { accessToken, refreshToken };
  }
}
