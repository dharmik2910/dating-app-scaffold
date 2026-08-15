import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@UseGuards(JwtAuthGuard)
@Controller('users/me')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  getMe(@CurrentUser() userId: string) {
    return this.usersService.getProfile(userId);
  }

  @Put()
  updateMe(@CurrentUser() userId: string, @Body() dto: UpdateProfileDto) {
    return this.usersService.upsertProfile(userId, dto);
  }
}
