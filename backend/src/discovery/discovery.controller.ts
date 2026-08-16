import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DiscoveryService } from './discovery.service';

@UseGuards(JwtAuthGuard)
@Controller('discovery')
export class DiscoveryController {
  constructor(private discoveryService: DiscoveryService) {}

  // Returns a paginated batch of candidate profiles.
  @Get()
  getCandidates(
    @CurrentUser() userId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.discoveryService.getCandidates(userId, cursor, limit);
  }
}
