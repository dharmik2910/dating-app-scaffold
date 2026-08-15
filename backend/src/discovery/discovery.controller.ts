import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DiscoveryService } from './discovery.service';

@UseGuards(JwtAuthGuard)
@Controller('discovery')
export class DiscoveryController {
  constructor(private discoveryService: DiscoveryService) {}

  // Returns a batch of candidate profiles: within distance/age preference,
  // not already swiped on, ordered by distance.
  @Get()
  getCandidates(@CurrentUser() userId: string) {
    return this.discoveryService.getCandidates(userId);
  }
}
