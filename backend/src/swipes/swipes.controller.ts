import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SwipesService } from './swipes.service';
import { CreateSwipeDto } from './dto/create-swipe.dto';

@UseGuards(JwtAuthGuard)
@Controller('swipes')
export class SwipesController {
  constructor(private swipesService: SwipesService) {}

  @Post()
  create(@CurrentUser() userId: string, @Body() dto: CreateSwipeDto) {
    return this.swipesService.swipe(userId, dto.swipedId, dto.action, dto.comment);
  }

  @Get('who-liked-me')
  whoLikedMe(@CurrentUser() userId: string) {
    return this.swipesService.getWhoLikedMe(userId);
  }

  @Post('boost')
  boost(@CurrentUser() userId: string, @Body('durationMinutes') minutes?: number) {
    return this.swipesService.boost(userId, minutes || 30);
  }

  @Get('quota')
  getQuota(@CurrentUser() userId: string) {
    return this.swipesService.getSwipeQuota(userId);
  }

  @Post('compliment')
  compliment(
    @CurrentUser() userId: string,
    @Body()
    body: {
      receiverId: string;
      content: string;
      targetType?: string;
      targetId?: string;
    },
  ) {
    return this.swipesService.compliment(
      userId,
      body.receiverId,
      body.content,
      body.targetType,
      body.targetId,
    );
  }
}

