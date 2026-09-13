import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() userId: string) {
    return this.usersService.getProfile(userId);
  }

  @Put('me')
  updateMe(@CurrentUser() userId: string, @Body() dto: UpdateProfileDto) {
    return this.usersService.upsertProfile(userId, dto);
  }

  @Patch('me')
  patchMe(@CurrentUser() userId: string, @Body() dto: UpdateProfileDto) {
    return this.usersService.upsertProfile(userId, dto);
  }

  @Patch('me/profile')
  patchMeProfile(@CurrentUser() userId: string, @Body() dto: UpdateProfileDto) {
    return this.usersService.upsertProfile(userId, dto);
  }

  @Post('me/prompts')
  addPrompt(
    @CurrentUser() userId: string,
    @Body() body: { question: string; answer: string; order?: number },
  ) {
    return this.usersService.addOrUpdatePrompt(
      userId,
      body.question,
      body.answer,
      body.order ?? 0,
    );
  }

  @Delete('me/prompts/:id')
  deletePrompt(@CurrentUser() userId: string, @Param('id') promptId: string) {
    return this.usersService.deletePrompt(userId, promptId);
  }

  @Post('me/voice-bio')
  setVoiceBio(
    @CurrentUser() userId: string,
    @Body('voiceBioUrl') voiceBioUrl: string | null,
  ) {
    return this.usersService.updateVoiceBio(userId, voiceBioUrl);
  }

  @Get(':id')
  getPublicProfile(@Param('id') id: string) {
    return this.usersService.getPublicProfile(id);
  }
}

