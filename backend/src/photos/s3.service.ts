import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

@Injectable()
export class S3Service {
  private client = new S3Client({
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  // Frontend requests this, then PUTs the file directly to the returned URL.
  async getUploadUrl(userId: string, contentType: string) {
    const key = `photos/${userId}/${randomUUID()}`;
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: 300 });
    const baseUrl = process.env.AWS_S3_PUBLIC_URL || `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com`;
    const publicUrl = `${baseUrl}/${key}`;
    return { uploadUrl, publicUrl, key };
  }

  async uploadBuffer(userId: string, buffer: Buffer, contentType: string) {
    const key = `photos/${userId}/${randomUUID()}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
    const baseUrl = process.env.AWS_S3_PUBLIC_URL || `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com`;
    const publicUrl = `${baseUrl}/${key}`;
    return { publicUrl, key };
  }


  async deleteObject(key: string) {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: process.env.AWS_S3_BUCKET_NAME, Key: key }),
    );
  }
}

