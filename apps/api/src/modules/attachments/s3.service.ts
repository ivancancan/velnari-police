import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3: S3Client | null;
  private readonly bucket: string | null;
  private readonly publicUrl: string | null;

  constructor(private readonly config: ConfigService) {
    const bucket = config.get<string>('AWS_S3_BUCKET');
    const region = config.get<string>('AWS_REGION') ?? 'us-east-1';

    if (bucket) {
      this.s3 = new S3Client({ region });
      this.bucket = bucket;
      this.publicUrl = config.get<string>('S3_PUBLIC_URL') ?? `https://${bucket}.s3.${region}.amazonaws.com`;
    } else {
      this.s3 = null;
      this.bucket = null;
      this.publicUrl = null;
      this.logger.warn('AWS_S3_BUCKET not set — using local disk storage');
    }
  }

  isStoringInS3(): boolean {
    return this.s3 !== null;
  }

  /**
   * Upload a file to S3 (or return local disk URL in dev).
   * Does NOT delete the local file — caller is responsible for cleanup.
   */
  async upload(filePath: string, mimetype: string): Promise<string> {
    if (!this.s3 || !this.bucket || !this.publicUrl) {
      // Dev fallback: return local disk URL
      const apiUrl = this.config.get<string>('API_URL') ?? 'http://localhost:3001';
      const filename = path.basename(filePath);
      return `${apiUrl}/uploads/${filename}`;
    }

    const key = `incidents/${randomUUID()}${path.extname(filePath)}`;
    const fileBuffer = fs.readFileSync(filePath);

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: fileBuffer,
        ContentType: mimetype,
      }),
    );

    return `${this.publicUrl}/${key}`;
  }
}
