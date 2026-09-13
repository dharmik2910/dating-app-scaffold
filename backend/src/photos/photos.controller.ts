import { BadRequestException, Body, Controller, Delete, InternalServerErrorException, Param, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PhotosService } from './photos.service';


@UseGuards(JwtAuthGuard)
@Controller('photos')
export class PhotosController {
  constructor(private photosService: PhotosService) {}

  // Step 1: get a signed URL to upload directly to S3 from the client.
  @Post('upload-url')
  async getUploadUrl(@CurrentUser() userId: string, @Body('contentType') contentType: string) {
    return await this.photosService.requestUploadUrl(userId, contentType);
  }

  // Direct backend upload fallback route (handles multipart form upload directly)
  @Post('upload-file')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @CurrentUser() userId: string,
    @UploadedFile() file: any,
    @Body('order') order?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file attached in request payload');
    }
    try {
      return await this.photosService.uploadDirectFile(userId, file, order ? parseInt(order, 10) : 0);
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('S3 Upload Error:', error);
      throw new InternalServerErrorException(error.message || 'S3 Upload Failed');
    }
  }

  // Direct backend base64 upload route
  @Post('upload-base64')
  async uploadBase64(
    @CurrentUser() userId: string,
    @Body() body: { base64: string; contentType?: string; order?: number },
  ) {
    if (!body?.base64) {
      throw new BadRequestException('No base64 data provided');
    }
    try {
      return await this.photosService.uploadBase64(
        userId,
        body.base64,
        body.contentType || 'image/jpeg',
        body.order || 0,
      );
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('Photo Base64 Upload Error:', error);
      throw new InternalServerErrorException(error.message || 'Photo upload failed');
    }
  }



  // Step 2: after the client PUTs the file to S3, confirm it so we save a Photo row.
  @Post('confirm')
  async confirm(@CurrentUser() userId: string, @Body() body: { publicUrl: string; key: string; order?: number }) {
    return await this.photosService.confirmUpload(userId, body.publicUrl, body.key, body.order);
  }

  @Delete(':id')
  remove(@CurrentUser() userId: string, @Param('id') id: string) {
    return this.photosService.remove(userId, id);
  }
}

