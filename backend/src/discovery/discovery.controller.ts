import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DiscoveryService } from './discovery.service';

@UseGuards(JwtAuthGuard)
@Controller('discovery')
export class DiscoveryController {
  constructor(private discoveryService: DiscoveryService) {}

  @Get()
  getCandidates(
    @CurrentUser() userId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('q') query?: string,
  ) {
    return this.discoveryService.getCandidates(userId, cursor, limit, query);
  }

  @Get('top-picks')
  getTopPicks(@CurrentUser() userId: string) {
    return this.discoveryService.getTopPicks(userId);
  }

  @Get('blind-date')
  getBlindDateQueue(@CurrentUser() userId: string) {
    return this.discoveryService.getBlindDateQueue(userId);
  }
}
