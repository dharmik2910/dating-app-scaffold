import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  @Get('users')
  getUsers(
    @Query('search') search?: string,
    @Query('verified') verified?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getUsers(
      search,
      verified === 'true' ? true : undefined,
      limit,
      status,
    );
  }

  @Patch('users/:id/verify')
  toggleVerify(
    @Param('id') userId: string,
    @Body('isVerified') isVerified?: boolean,
  ) {
    return this.adminService.toggleVerifyUser(userId, isVerified);
  }

  @Patch('users/:id/ban')
  toggleBan(
    @Param('id') userId: string,
    @Body('isBanned') isBanned: boolean,
    @Body('banReason') banReason?: string,
  ) {
    return this.adminService.toggleBanUser(userId, isBanned, banReason);
  }

  @Delete('users/:id')
  deleteUser(@Param('id') userId: string) {
    return this.adminService.deleteUser(userId);
  }

  @Get('reports')
  getReports(@Query('status') status?: string) {
    return this.adminService.getReports(status);
  }

  @Patch('reports/:id')
  updateReportStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.adminService.updateReportStatus(id, status);
  }

  @Post('announcement')
  broadcastAnnouncement(
    @Body('title') title: string,
    @Body('body') body: string,
    @Body('data') data?: any,
  ) {
    return this.adminService.broadcastAnnouncement(title, body, data);
  }

  @Get('stories')
  getStories() {
    return this.adminService.getStories();
  }

  @Delete('stories/:id')
  deleteStory(@Param('id') storyId: string) {
    return this.adminService.deleteStory(storyId);
  }

  @Get('safe-dates')
  getSafeDates() {
    return this.adminService.getSafeDates();
  }
}

