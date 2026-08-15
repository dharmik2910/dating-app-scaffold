import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from './s3.service';

@Injectable()
export class PhotosService {
  constructor(private prisma: PrismaService, private s3: S3Service) {}

  requestUploadUrl(userId: string, contentType: string) {
    return this.s3.getUploadUrl(userId, contentType);
  }

  async uploadDirectFile(userId: string, file: any, order = 0) {
    const { publicUrl, key } = await this.s3.uploadBuffer(userId, file.buffer, file.mimetype);
    return this.prisma.photo.create({
      data: { userId, url: publicUrl, order },
    });
  }

  confirmUpload(userId: string, publicUrl: string, key: string, order = 0) {
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

