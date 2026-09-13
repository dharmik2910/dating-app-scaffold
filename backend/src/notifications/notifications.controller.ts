import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  private getUserId(req: any): string {
    return req.user?.id || req.user?.userId || req.userId;
  }

  @Post('token')
  registerToken(
    @Request() req: any,
    @Body() body: { token: string; platform?: string },
  ) {
    return this.notificationsService.registerToken(
      this.getUserId(req),
      body.token,
      body.platform,
    );
  }

  @Get()
  getNotifications(@Request() req: any) {
    return this.notificationsService.getNotifications(this.getUserId(req));
  }

  @Patch(':id/read')
  markAsRead(@Request() req: any, @Param('id') id: string) {
    return this.notificationsService.markAsRead(id, this.getUserId(req));
  }

  @Patch('read-all')
  markAllAsRead(@Request() req: any) {
    return this.notificationsService.markAllAsRead(this.getUserId(req));
  }
}
