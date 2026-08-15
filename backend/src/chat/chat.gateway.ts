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
import { UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';

@WebSocketGateway({ cors: { origin: process.env.FRONTEND_URL || '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;

  constructor(private jwt: JwtService, private chatService: ChatService) {}

  // Auth on connect: client passes JWT as `auth: { token }` in the socket.io handshake.
  handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token;
      const payload = this.jwt.verify(token, { secret: process.env.JWT_SECRET });
      (client.data as any).userId = payload.sub;
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect() {}

  @SubscribeMessage('joinMatch')
  onJoinMatch(@ConnectedSocket() client: Socket, @MessageBody() matchId: string) {
    client.join(`match:${matchId}`);
  }

  @SubscribeMessage('sendMessage')
  async onSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { matchId: string; content: string },
  ) {
    const senderId = (client.data as any).userId;
    const message = await this.chatService.saveMessage(body.matchId, senderId, body.content);
    this.server.to(`match:${body.matchId}`).emit('newMessage', message);
    return message;
  }
}
