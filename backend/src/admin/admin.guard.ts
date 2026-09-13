import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const ADMIN_PHONE = process.env.ADMIN_PHONE || '9924662647';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const userId = req.user?.id || req.user?.userId || req.userId;

    if (!userId) {
      throw new ForbiddenException('Authentication required for admin portal.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, phone: true },
    });

    if (!user) {
      throw new ForbiddenException('User not found.');
    }

    const adminPhoneDigits = ADMIN_PHONE.replace(/\D/g, '');
    const userPhoneDigits = (user.phone || '').replace(/\D/g, '');

    const isAuthorized =
      !adminPhoneDigits ||
      userPhoneDigits.includes(adminPhoneDigits) ||
      (userPhoneDigits.length >= 10 && userPhoneDigits.endsWith(adminPhoneDigits)) ||
      process.env.NODE_ENV === 'development';

    if (!isAuthorized) {
      throw new ForbiddenException(
        'Access Denied: You do not have administrator permissions to access this panel.',
      );
    }

    return true;
  }
}
