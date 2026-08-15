import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SwipesService } from './swipes.service';
import { CreateSwipeDto } from './dto/create-swipe.dto';

@UseGuards(JwtAuthGuard)
@Controller('swipes')
export class SwipesController {
  constructor(private swipesService: SwipesService) {}

  // Returns { matched: boolean, match?: Match } so the frontend can show
  // an "It's a match!" screen immediately.
  @Post()
  create(@CurrentUser() userId: string, @Body() dto: CreateSwipeDto) {
    return this.swipesService.swipe(userId, dto.swipedId, dto.action);
  }
}
