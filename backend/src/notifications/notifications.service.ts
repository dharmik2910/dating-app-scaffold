import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatGateway } from '../chat/chat.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => ChatGateway))
    private chatGateway: ChatGateway,
  ) {}

  async registerToken(userId: string, token: string, platform = 'expo') {
    return this.prisma.deviceToken.upsert({
      where: { token },
      update: { userId, platform },
      create: { userId, token, platform },
    });
  }

  async createNotification(
    userId: string,
    type: string,
    title: string,
    body: string,
    data?: any,
  ) {
    const notification = await this.prisma.appNotification.create({
      data: {
        userId,
        type,
        title,
        body,
        data: data || {},
      },
    });

    // 1. Emit live real-time WebSocket event to active client room
    try {
      this.chatGateway.server?.to(`user:${userId}`).emit('notification', notification);
    } catch (err) {
      console.warn('Socket notification emit failed:', err);
    }

    // 2. Send native push notifications if user has registered device tokens
    this.sendPushNotification(userId, title, body, { ...data, type, notificationId: notification.id }).catch((err) => {
      console.warn('Push notification delivery failed:', err);
    });

    return notification;
  }

  private async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    data?: any,
  ) {
    try {
      const deviceTokens = await this.prisma.deviceToken.findMany({
        where: { userId },
      });

      if (!deviceTokens || deviceTokens.length === 0) return;

      const expoTokens = deviceTokens
        .filter((d) => d.token && (d.token.startsWith('ExponentPushToken[') || d.token.startsWith('ExpoPushToken[')))
        .map((d) => d.token);

      if (expoTokens.length === 0) return;

      const messages = expoTokens.map((to) => ({
        to,
        sound: 'default',
        title,
        body,
        data: data || {},
        priority: 'high',
      }));

      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });
    } catch (error) {
      console.warn('Failed to send Expo push notifications:', error);
    }
  }

  async getNotifications(userId: string) {
    return this.prisma.appNotification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });
  }

  async markAsRead(id: string, userId: string) {
    return this.prisma.appNotification.updateMany({
      where: { id, userId },
      data: { read: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.appNotification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }
}

