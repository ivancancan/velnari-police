import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import * as multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { BugReportEntity } from '../../entities/bug-report.entity';
import { UserEntity } from '../../entities/user.entity';
import { BugReportsController } from './bug-reports.controller';
import { BugReportsService } from './bug-reports.service';
import { AttachmentsModule } from '../attachments/attachments.module';

const UPLOADS_DIR = path.join(process.cwd(), 'apps/api/uploads/bug-reports');

@Module({
  imports: [
    TypeOrmModule.forFeature([BugReportEntity, UserEntity]),
    MulterModule.register({
      storage: multer.diskStorage({
        destination: (_req, _file, cb) => {
          fs.mkdirSync(UPLOADS_DIR, { recursive: true });
          cb(null, UPLOADS_DIR);
        },
        filename: (_req, file, cb) => {
          cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB screenshots max
      fileFilter: (_req, file, cb) => {
        const ok = ['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype);
        cb(ok ? null : new Error('Solo se permiten imágenes PNG/JPEG/WebP'), ok);
      },
    }),
    AttachmentsModule,
  ],
  controllers: [BugReportsController],
  providers: [BugReportsService],
  exports: [BugReportsService],
})
export class SupportModule {}
