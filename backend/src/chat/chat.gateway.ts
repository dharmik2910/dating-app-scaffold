import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';

@WebSocketGateway({ cors: { origin: process.env.FRONTEND_URL || '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;

  // Real-time presence tracking: userId -> Set<socketId>
  private userSockets = new Map<string, Set<string>>();
  // Real-time last active timestamp: userId -> Date
  private lastActiveMap = new Map<string, Date>();

  constructor(private jwt: JwtService, private chatService: ChatService) {}

  public isUserOnline(userId: string): boolean {
    return (this.userSockets.get(userId)?.size || 0) > 0;
  }

  public getLastActive(userId: string): Date | null {
    return this.lastActiveMap.get(userId) || null;
  }

  // Auth on connect: client passes JWT as auth: { token }, header, or query
  handleConnection(client: Socket) {
    try {
      let token = client.handshake.auth?.token;
      if (!token && client.handshake.headers?.authorization) {
        token = client.handshake.headers.authorization.replace(/^Bearer\s+/i, '');
      }
      if (!token && client.handshake.query?.token) {
        token = Array.isArray(client.handshake.query.token)
          ? client.handshake.query.token[0]
          : client.handshake.query.token;
      }

      if (!token) {
        return;
      }
      const payload = this.jwt.verify(token, { secret: process.env.JWT_SECRET });
      const userId = payload.sub;
      if (!userId) return;
      (client.data as any).userId = userId;

      client.join(`user:${userId}`);

      // Track online socket count for this user
      const sockets = this.userSockets.get(userId) || new Set<string>();
      const wasOnline = sockets.size > 0;
      sockets.add(client.id);
      this.userSockets.set(userId, sockets);
      const now = new Date();
      this.lastActiveMap.set(userId, now);

      // If newly online, broadcast real-time presence change to connected clients
      if (!wasOnline) {
        this.server.emit('userStatusChanged', {
          userId,
          isOnline: true,
          lastActiveAt: now.toISOString(),
        });
      }
    } catch {
      // Allow unauthenticated connection for now; client can authenticate via 'authenticate' event
    }
  }

  @SubscribeMessage('authenticate')
  onAuthenticate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data?: { token?: string },
  ) {
    try {
      const token = data?.token || client.handshake.auth?.token;
      if (!token) return { success: false };
      const payload = this.jwt.verify(token, { secret: process.env.JWT_SECRET });
      const userId = payload.sub;
      if (userId) {
        (client.data as any).userId = userId;
        client.join(`user:${userId}`);
        const sockets = this.userSockets.get(userId) || new Set<string>();
        const wasOnline = sockets.size > 0;
        sockets.add(client.id);
        this.userSockets.set(userId, sockets);
        const now = new Date();
        this.lastActiveMap.set(userId, now);
        if (!wasOnline) {
          this.server.emit('userStatusChanged', {
            userId,
            isOnline: true,
            lastActiveAt: now.toISOString(),
          });
        }
        return { success: true, userId };
      }
    } catch {
      return { success: false };
    }
    return { success: false };
  }

  handleDisconnect(client: Socket) {
    const userId = (client.data as any)?.userId;
    if (userId) {
      const sockets = this.userSockets.get(userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.userSockets.delete(userId);
          const now = new Date();
          this.lastActiveMap.set(userId, now);

          // Broadcast user went offline with updated lastActive timestamp
          this.server.emit('userStatusChanged', {
            userId,
            isOnline: false,
            lastActiveAt: now.toISOString(),
          });
        }
      }
    }
  }

  @SubscribeMessage('heartbeat')
  onHeartbeat(@ConnectedSocket() client: Socket) {
    const userId = (client.data as any)?.userId;
    if (userId) {
      this.lastActiveMap.set(userId, new Date());
    }
  }

  @SubscribeMessage('queryPresence')
  onQueryPresence(
    @ConnectedSocket() client: Socket,
    @MessageBody() userIds: string[],
  ) {
    if (!Array.isArray(userIds)) return [];
    return userIds.map((uid) => ({
      userId: uid,
      isOnline: this.isUserOnline(uid),
      lastActiveAt: this.lastActiveMap.get(uid)?.toISOString() || null,
    }));
  }

  @SubscribeMessage('joinMatch')
  async onJoinMatch(@ConnectedSocket() client: Socket, @MessageBody() matchId: string) {
    const userId = (client.data as any)?.userId;
    if (!userId || !matchId) return;

    // Secure room join: verify that user is an actual participant of this match
    const isMember = await this.chatService.isParticipant(matchId, userId);
    if (isMember) {
      client.join(`match:${matchId}`);
    }

    this.lastActiveMap.set(userId, new Date());
  }

  @SubscribeMessage('leaveMatch')
  onLeaveMatch(@ConnectedSocket() client: Socket, @MessageBody() matchId: string) {
    if (matchId) {
      client.leave(`match:${matchId}`);
    }
  }

  @SubscribeMessage('markAsRead')
  async onMarkAsRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() matchId: string,
  ) {
    const userId = (client.data as any)?.userId;
    if (!userId || !matchId) return;

    const readAt = await this.chatService.markMessagesAsRead(matchId, userId);
    this.server.to(`match:${matchId}`).emit('messagesRead', {
      matchId,
      readerId: userId,
      readAt: readAt.toISOString(),
    });
  }

  @SubscribeMessage('sendMessage')
  async onSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { matchId: string; content: string },
  ) {
    const senderId = (client.data as any).userId;
    if (!senderId || !body?.matchId || !body?.content?.trim()) {
      return;
    }

    this.lastActiveMap.set(senderId, new Date());

    // Save message with strict participant authorization
    const message = await this.chatService.saveMessage(body.matchId, senderId, body.content.trim());
    
    // Broadcast message ONLY to the two matched users in this specific match room
    this.server.to(`match:${body.matchId}`).emit('newMessage', message);

    // Also emit live chat notification strictly to the recipient user's private personal room
    if (message.recipientId) {
      this.server.to(`user:${message.recipientId}`).emit('chatNotification', {
        matchId: body.matchId,
        messageId: message.id,
        senderId: message.senderId,
        senderName: message.sender?.name || 'Someone',
        senderPhoto: message.sender?.photo || null,
        content: message.content,
        sentAt: message.sentAt,
      });
    }

    return message;
  }
}
