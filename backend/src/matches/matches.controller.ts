import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MatchesService } from './matches.service';

@UseGuards(JwtAuthGuard)
@Controller('matches')
export class MatchesController {
  constructor(private matchesService: MatchesService) {}

  @Get()
  list(
    @CurrentUser() userId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.matchesService.listForUser(userId, cursor, limit);
  }
}
