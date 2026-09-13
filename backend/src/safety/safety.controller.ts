import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SafetyService } from './safety.service';

@Controller('safety')
@UseGuards(JwtAuthGuard)
export class SafetyController {
  constructor(private safetyService: SafetyService) {}

  private getUserId(req: any): string {
    return req.user?.id || req.user?.userId || req.userId;
  }

  @Post('block')
  blockUser(@Request() req: any, @Body('blockedId') blockedId: string) {
    return this.safetyService.blockUser(this.getUserId(req), blockedId);
  }

  @Delete('block/:userId')
  unblockUser(@Request() req: any, @Param('userId') blockedId: string) {
    return this.safetyService.unblockUser(this.getUserId(req), blockedId);
  }

  @Get('blocked')
  getBlockedUsers(@Request() req: any) {
    return this.safetyService.getBlockedUsers(this.getUserId(req));
  }

  @Post('report')
  reportUser(
    @Request() req: any,
    @Body() body: any,
  ) {
    const reporterId = this.getUserId(req);
    const reportedId =
      body?.reportedId ||
      body?.reportedUserId ||
      body?.userId ||
      body?.targetUserId;
    const reason = body?.reason || 'other';
    const details = body?.details || body?.notes || body?.description || '';
    return this.safetyService.reportUser(
      reporterId,
      reportedId,
      reason,
      details,
    );
  }

  @Get('reports')
  getReports(@Query('status') status?: string) {
    return this.safetyService.getReports(status);
  }

  @Patch('reports/:id')
  updateReportStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.safetyService.updateReportStatus(id, status);
  }

  @Post('verify-photo')
  verifyPhoto(@Request() req: any, @Body('selfieUrl') selfieUrl: string) {
    return this.safetyService.verifyPhoto(this.getUserId(req), selfieUrl);
  }

  @Post('safe-date')
  createSafeDate(
    @Request() req: any,
    @Body()
    body: {
      matchId: string;
      contactName: string;
      contactPhone: string;
      locationName: string;
      locationLat?: number;
      locationLng?: number;
      scheduledTime: string;
      notes?: string;
    },
  ) {
    return this.safetyService.createSafeDate(this.getUserId(req), body);
  }

  @Get('safe-dates')
  getSafeDates(@Request() req: any) {
    return this.safetyService.getSafeDates(this.getUserId(req));
  }

  @Patch('safe-date/:id/checkin')
  checkInSafeDate(
    @Request() req: any,
    @Param('id') id: string,
    @Body('status') status: 'SAFE' | 'ALERT',
  ) {
    return this.safetyService.checkInSafeDate(id, this.getUserId(req), status || 'SAFE');
  }
}
