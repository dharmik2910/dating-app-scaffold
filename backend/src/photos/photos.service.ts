import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from './s3.service';

export const MAX_PHOTOS = 6;

@Injectable()
export class PhotosService {
  constructor(private prisma: PrismaService, private s3: S3Service) {}

  async requestUploadUrl(userId: string, contentType: string) {
    const count = await this.prisma.photo.count({ where: { userId } });
    if (count >= MAX_PHOTOS) {
      throw new BadRequestException(`Maximum ${MAX_PHOTOS} photos allowed. Please delete a photo before uploading a new one.`);
    }
    return this.s3.getUploadUrl(userId, contentType);
  }

  async uploadDirectFile(userId: string, file: any, order = 0) {
    const count = await this.prisma.photo.count({ where: { userId } });
    if (count >= MAX_PHOTOS) {
      throw new BadRequestException(`Maximum ${MAX_PHOTOS} photos allowed. Please delete a photo before uploading a new one.`);
    }
    const { publicUrl, key } = await this.s3.uploadBuffer(userId, file.buffer, file.mimetype);
    return this.prisma.photo.create({
      data: { userId, url: publicUrl, order },
    });
  }

  async uploadBase64(userId: string, base64Data: string, contentType = 'image/jpeg', order = 0) {
    const count = await this.prisma.photo.count({ where: { userId } });
    if (count >= MAX_PHOTOS) {
      throw new BadRequestException(`Maximum ${MAX_PHOTOS} photos allowed. Please delete a photo before uploading a new one.`);
    }
    const cleanBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    const { publicUrl } = await this.s3.uploadBuffer(userId, buffer, contentType, 'photos');
    return this.prisma.photo.create({
      data: { userId, url: publicUrl, order },
    });
  }

  async confirmUpload(userId: string, publicUrl: string, key: string, order = 0) {
    const count = await this.prisma.photo.count({ where: { userId } });
    if (count >= MAX_PHOTOS) {
      throw new BadRequestException(`Maximum ${MAX_PHOTOS} photos allowed. Please delete a photo before uploading a new one.`);
    }
    return this.prisma.photo.create({
      data: { userId, url: publicUrl, order },
    });
    // `key` can be stored too if you add an s3Key column, useful for deletion.
  }

  async remove(userId: string, photoId: string) {
    const photo = await this.prisma.photo.findUnique({ where: { id: photoId } });
    if (!photo || photo.userId !== userId) throw new ForbiddenException();
    return this.prisma.photo.delete({ where: { id: photoId } });
  }
}


