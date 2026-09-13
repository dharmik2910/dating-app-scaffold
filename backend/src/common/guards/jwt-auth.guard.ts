import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedException();

    try {
      const secret = process.env.JWT_SECRET || 'change-me';
      const payload = this.jwt.verify(authHeader.split(' ')[1], { secret });
      const userId = payload.sub || payload.id || payload.userId;
      req.userId = userId;
      req.user = {
        id: userId,
        userId: userId,
        phone: payload.phone,
        ...(typeof payload === 'object' ? payload : {}),
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}

