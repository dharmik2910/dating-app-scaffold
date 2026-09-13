import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  InternalServerErrorException,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { StoriesService } from './stories.service';

@UseGuards(JwtAuthGuard)
@Controller('stories')
export class StoriesController {
  constructor(private storiesService: StoriesService) {}

  @Post('upload-file')
  @UseInterceptors(FileInterceptor('file'))
  async uploadStoryFile(
    @CurrentUser() userId: string,
    @UploadedFile() file: any,
  ) {
    if (!file) {
      throw new BadRequestException('No media file attached');
    }
    try {
      return await this.storiesService.uploadStoryMedia(userId, file);
    } catch (error: any) {
      console.error('Story Upload Error:', error);
      throw new InternalServerErrorException(error.message || 'Story upload failed');
    }
  }

  @Post('upload-base64')
  async uploadStoryBase64(
    @CurrentUser() userId: string,
    @Body() body: { base64: string; contentType?: string },
  ) {
    if (!body?.base64) {
      throw new BadRequestException('No base64 data provided');
    }
    try {
      return await this.storiesService.uploadStoryBase64(
        userId,
        body.base64,
        body.contentType || 'image/jpeg',
      );
    } catch (error: any) {
      console.error('Story Base64 Upload Error:', error);
      throw new InternalServerErrorException(error.message || 'Story upload failed');
    }
  }

  @Get('feed')
  getFeed(@CurrentUser() userId: string) {
    return this.storiesService.getFeed(userId);
  }

  @Post()
  createStory(
    @CurrentUser() userId: string,
    @Body() body: { mediaUrl: string; mediaType?: string; caption?: string },
  ) {
    return this.storiesService.createStory(
      userId,
      body.mediaUrl,
      body.mediaType || 'image',
      body.caption,
    );
  }

  @Post(':id/view')
  markViewed(@CurrentUser() userId: string, @Param('id') storyId: string) {
    return this.storiesService.markViewed(storyId, userId);
  }

  @Get(':id/viewers')
  getStoryViewers(@CurrentUser() userId: string, @Param('id') storyId: string) {
    return this.storiesService.getStoryViewers(storyId, userId);
  }

  @Delete(':id')
  deleteStory(@CurrentUser() userId: string, @Param('id') storyId: string) {
    return this.storiesService.deleteStory(storyId, userId);
  }
}
