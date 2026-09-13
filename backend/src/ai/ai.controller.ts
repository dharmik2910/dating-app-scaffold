import { Controller, Get, Post, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AiService } from './ai.service';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private aiService: AiService) {}

  private getUserId(req: any): string {
    return req.user?.id || req.user?.userId || req.userId;
  }

  @Post('icebreakers/:targetUserId')
  getIcebreakers(@Request() req: any, @Param('targetUserId') targetUserId: string) {
    return this.aiService.generateIcebreakers(this.getUserId(req), targetUserId);
  }

  @Get('compatibility/:targetUserId')
  getCompatibility(@Request() req: any, @Param('targetUserId') targetUserId: string) {
    return this.aiService.getCompatibility(this.getUserId(req), targetUserId);
  }

  @Post('generate-bio')
  generateBio(
    @Request() req: any,
    @Body('vibe') vibe?: 'funny' | 'romantic' | 'adventurous' | 'creative',
  ) {
    return this.aiService.generateBio(this.getUserId(req), vibe || 'creative');
  }
}

