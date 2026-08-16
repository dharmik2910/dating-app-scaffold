import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

@Injectable()
export class S3Service {
  private client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
  });

  async getUploadUrl(userId: string, contentType: string) {
    const key = `photos/${userId}/${randomUUID()}`;
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: 300 });
    const baseUrl =
      process.env.AWS_S3_PUBLIC_URL ||
      `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com`;
    const publicUrl = `${baseUrl}/${key}`;
    return { uploadUrl, publicUrl, key };
  }

  async uploadBuffer(userId: string, buffer: Buffer, contentType: string) {
    const key = `photos/${userId}/${randomUUID()}`;
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET_NAME,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        }),
      );
      const baseUrl =
        process.env.AWS_S3_PUBLIC_URL ||
        `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com`;
      const publicUrl = `${baseUrl}/${key}`;
      return { publicUrl, key };
    } catch (error) {
      console.warn('S3 upload error/timeout, using fast base64 fallback:', (error as any)?.message);
      const base64 = buffer.toString('base64');
      const publicUrl = `data:${contentType};base64,${base64}`;
      return { publicUrl, key };
    }
  }

  async deleteObject(key: string) {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: process.env.AWS_S3_BUCKET_NAME, Key: key }),
      );
    } catch (err) {
      console.warn('S3 delete object error:', (err as any)?.message);
    }
  }
}
