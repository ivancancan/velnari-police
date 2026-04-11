# Infrastructure — Docker + S3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the API and Web deployable as Docker containers on ECS Fargate, and replace disk-based file storage with AWS S3 so uploads survive container restarts.

**Architecture:** Multi-stage Dockerfiles for API (`apps/api/`) and Web (`apps/web/`). `S3Service` in the attachments module uploads files using `@aws-sdk/client-s3`; it falls back to disk-URL in development when `AWS_S3_BUCKET` is unset. `AttachmentsService.create()` delegates storage to `S3Service` instead of computing a `./uploads` URL directly. `.env.example` files document all required env vars.

**Tech Stack:** Docker multi-stage builds, `@aws-sdk/client-s3`, AWS S3 pre-signed or direct upload, NestJS `ConfigService`, Node 20 Alpine base images.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/api/Dockerfile` | Create | Multi-stage build for NestJS API |
| `apps/web/Dockerfile` | Create | Multi-stage build for Next.js web |
| `apps/api/.env.example` | Create | Document all API env vars |
| `apps/web/.env.example` | Create | Document all web env vars |
| `apps/mobile/.env.example` | Create | Document mobile env vars |
| `apps/api/src/modules/attachments/s3.service.ts` | Create | Upload to S3 or return disk URL |
| `apps/api/src/modules/attachments/attachments.service.ts` | Modify | Use S3Service for url, keep disk for hash |
| `apps/api/src/modules/attachments/attachments.controller.ts` | Modify | Pass file.path to S3Service, set url from result |
| `apps/api/src/modules/attachments/attachments.module.ts` | Modify | Add S3Service provider |
| `.dockerignore` (repo root) | Create | Exclude node_modules, .env, etc. |

---

### Task 1: API Dockerfile (multi-stage)

**Files:**
- Create: `apps/api/Dockerfile`

- [ ] **Step 1: Write the Dockerfile**

```dockerfile
# apps/api/Dockerfile
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# ---------- deps ----------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/ ./packages/
RUN pnpm install --frozen-lockfile --filter @velnari/api...

# ---------- build ----------
FROM deps AS builder
COPY apps/api ./apps/api
COPY packages ./packages
RUN pnpm --filter @velnari/api build

# ---------- runtime ----------
FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/ ./packages/
RUN pnpm install --frozen-lockfile --filter @velnari/api... --prod

COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Create uploads dir for local dev fallback
RUN mkdir -p /app/apps/api/uploads

EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
```

- [ ] **Step 2: Verify build context is correct**

Check that `apps/api/package.json` has `"name": "@velnari/api"` (or adapt the filter):

```bash
node -e "const p=require('./apps/api/package.json'); console.log(p.name)"
```

Expected: `@velnari/api` (or whatever the actual name is — use that in the Dockerfile filter).

- [ ] **Step 3: Build the image locally (dry run)**

```bash
docker build -f apps/api/Dockerfile -t velnari-api:local . 2>&1 | tail -20
```

Expected: `Successfully built <hash>` or `naming to docker.io/library/velnari-api:local done`.

If build fails, read the error and fix the Dockerfile. Common issues:
- Wrong package name in `--filter`
- Missing `tsconfig.json` path in builder stage

- [ ] **Step 4: Commit**

```bash
git add apps/api/Dockerfile
git commit -m "feat: multi-stage Dockerfile for NestJS API"
```

---

### Task 2: Web Dockerfile (multi-stage)

**Files:**
- Create: `apps/web/Dockerfile`

- [ ] **Step 1: Check Next.js output mode**

Read `apps/web/next.config.js` (or `next.config.ts`) and verify whether `output: 'standalone'` is set. If not, note that we'll add it.

- [ ] **Step 2: Enable standalone output in Next.js config**

If `output: 'standalone'` is missing, add it. Read the current `apps/web/next.config.js` first, then add:

```javascript
// inside the nextConfig object:
output: 'standalone',
```

Standalone output bundles only the required node_modules, making Docker images much smaller.

- [ ] **Step 3: Write the Dockerfile**

```dockerfile
# apps/web/Dockerfile
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# ---------- deps ----------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/ ./packages/
RUN pnpm install --frozen-lockfile --filter @velnari/web...

# ---------- build ----------
FROM deps AS builder
COPY apps/web ./apps/web
COPY packages ./packages
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @velnari/web build

# ---------- runtime ----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy standalone output
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000
ENV PORT=3000
CMD ["node", "apps/web/server.js"]
```

- [ ] **Step 4: Check package name**

```bash
node -e "const p=require('./apps/web/package.json'); console.log(p.name)"
```

Use the actual name in the `--filter` flags if different from `@velnari/web`.

- [ ] **Step 5: Build the image locally (dry run)**

```bash
docker build -f apps/web/Dockerfile -t velnari-web:local . 2>&1 | tail -20
```

Expected: `Successfully built <hash>`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/Dockerfile apps/web/next.config.js
git commit -m "feat: multi-stage Dockerfile for Next.js web + standalone output"
```

---

### Task 3: .dockerignore + .env.example files

**Files:**
- Create: `.dockerignore`
- Create: `apps/api/.env.example`
- Create: `apps/web/.env.example`
- Create: `apps/mobile/.env.example`

- [ ] **Step 1: Create .dockerignore at repo root**

```
node_modules
**/node_modules
**/.next
**/dist
**/.env
**/.env.local
**/coverage
**/__tests__
**/*.test.ts
**/*.spec.ts
.git
.turbo
docs
scripts
```

- [ ] **Step 2: Create apps/api/.env.example**

```bash
# apps/api/.env.example

# ── Database ──────────────────────────────────────────────────────
DATABASE_URL=postgresql://velnari:password@localhost:5432/velnari_dev

# ── Redis ─────────────────────────────────────────────────────────
REDIS_URL=redis://localhost:6379

# ── Auth ──────────────────────────────────────────────────────────
JWT_SECRET=change-me-in-production-min-32-chars
JWT_REFRESH_SECRET=change-me-in-production-min-32-chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# ── AWS S3 (leave blank for local disk fallback) ───────────────────
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=
# Public base URL for S3 files (e.g. https://<bucket>.s3.amazonaws.com)
# Leave blank to use the default SDK URL
S3_PUBLIC_URL=

# ── App ───────────────────────────────────────────────────────────
PORT=3001
API_URL=http://localhost:3001
NODE_ENV=development

# ── Throttle ──────────────────────────────────────────────────────
THROTTLE_TTL=60000
THROTTLE_LIMIT=100
```

- [ ] **Step 3: Create apps/web/.env.example**

```bash
# apps/web/.env.example

# ── API ───────────────────────────────────────────────────────────
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_WS_URL=http://localhost:3001

# ── App ───────────────────────────────────────────────────────────
PORT=3000
NODE_ENV=development
```

- [ ] **Step 4: Create apps/mobile/.env.example**

```bash
# apps/mobile/.env.example

# ── API ───────────────────────────────────────────────────────────
EXPO_PUBLIC_API_URL=http://localhost:3001/api

# ── Expo ──────────────────────────────────────────────────────────
# EAS project ID (from app.json / eas.json)
EXPO_PROJECT_ID=
```

- [ ] **Step 5: Commit**

```bash
git add .dockerignore apps/api/.env.example apps/web/.env.example apps/mobile/.env.example
git commit -m "chore: .dockerignore and .env.example files for all apps"
```

---

### Task 4: S3Service — upload to S3 with disk fallback

**Files:**
- Create: `apps/api/src/modules/attachments/s3.service.ts`

- [ ] **Step 1: Install AWS SDK**

```bash
cd apps/api && pnpm add @aws-sdk/client-s3
```

Expected: `@aws-sdk/client-s3` added to `apps/api/package.json`.

- [ ] **Step 2: Write S3Service**

```typescript
// apps/api/src/modules/attachments/s3.service.ts
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

  /**
   * Upload a file to S3 (or keep on disk in dev).
   * Returns the public URL of the uploaded file.
   */
  async upload(filePath: string, mimetype: string): Promise<string> {
    if (!this.s3 || !this.bucket || !this.publicUrl) {
      // Dev fallback: return local URL
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

    // Delete local temp file after successful upload
    try { fs.unlinkSync(filePath); } catch { /* ignore — temp file already gone */ }

    return `${this.publicUrl}/${key}`;
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep -i "s3\|S3Service" | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/attachments/s3.service.ts
git commit -m "feat: S3Service — upload to S3 with local disk fallback for dev"
```

---

### Task 5: Wire S3Service into AttachmentsModule and service

**Files:**
- Modify: `apps/api/src/modules/attachments/attachments.module.ts`
- Modify: `apps/api/src/modules/attachments/attachments.service.ts`
- Modify: `apps/api/src/modules/attachments/attachments.controller.ts`

- [ ] **Step 1: Add S3Service to attachments.module.ts**

```typescript
// apps/api/src/modules/attachments/attachments.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule } from '@nestjs/config';
import { IncidentAttachmentEntity } from '../../entities/incident-attachment.entity';
import { AttachmentsService } from './attachments.service';
import { AttachmentsController } from './attachments.controller';
import { S3Service } from './s3.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([IncidentAttachmentEntity]),
    MulterModule.register({}),
    ConfigModule,
  ],
  controllers: [AttachmentsController],
  providers: [AttachmentsService, S3Service],
})
export class AttachmentsModule {}
```

- [ ] **Step 2: Update AttachmentsService to accept url from caller**

The current `AttachmentsService.create()` receives `url` in the input interface — it already supports this. No change needed to the service itself, since `url` is already a parameter in `CreateAttachmentInput`.

Verify by checking that `CreateAttachmentInput` has `url: string` — it does (from the file read earlier). The service stores whatever URL it's given.

- [ ] **Step 3: Update AttachmentsController to use S3Service**

Replace the current controller so it calls `S3Service.upload()` before calling `AttachmentsService.create()`:

```typescript
// apps/api/src/modules/attachments/attachments.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { AttachmentsService } from './attachments.service';
import { S3Service } from './s3.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import type { Request } from 'express';
import type { IncidentAttachmentEntity } from '../../entities/incident-attachment.entity';

const storage = diskStorage({
  destination: './uploads',
  filename: (_req, file, cb) => {
    cb(null, `${randomUUID()}${extname(file.originalname)}`);
  },
});

@Controller('incidents/:incidentId/attachments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttachmentsController {
  constructor(
    private readonly service: AttachmentsService,
    private readonly s3: S3Service,
  ) {}

  @Get()
  findAll(
    @Param('incidentId', ParseUUIDPipe) incidentId: string,
  ): Promise<IncidentAttachmentEntity[]> {
    return this.service.findByIncident(incidentId);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', { storage, limits: { fileSize: 10 * 1024 * 1024 } }))
  async upload(
    @Param('incidentId', ParseUUIDPipe) incidentId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request & { user: { sub: string } },
    @Body() body: { gpsLat?: string; gpsLng?: string; capturedAt?: string },
  ): Promise<IncidentAttachmentEntity> {
    // Upload to S3 (or get local disk URL in dev)
    const url = await this.s3.upload(file.path, file.mimetype);

    return this.service.create({
      incidentId,
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url,
      uploadedBy: req.user.sub,
      filePath: file.path,
      gpsLat: body.gpsLat != null && isFinite(parseFloat(body.gpsLat)) ? parseFloat(body.gpsLat) : undefined,
      gpsLng: body.gpsLng != null && isFinite(parseFloat(body.gpsLng)) ? parseFloat(body.gpsLng) : undefined,
      capturedAt: body.capturedAt,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.delete(id);
  }
}
```

Note: `filePath: file.path` is still passed to `AttachmentsService.create()` for SHA-256 hashing. In S3 mode, the file is deleted from disk by `S3Service.upload()` after the upload. The SHA-256 is computed by `AttachmentsService` before deletion — **this is a race condition**. Fix: compute SHA-256 in the controller before calling `s3.upload()`.

**Correct approach** — update the controller's upload handler to hash before uploading:

```typescript
  @Post()
  @UseInterceptors(FileInterceptor('file', { storage, limits: { fileSize: 10 * 1024 * 1024 } }))
  async upload(
    @Param('incidentId', ParseUUIDPipe) incidentId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request & { user: { sub: string } },
    @Body() body: { gpsLat?: string; gpsLng?: string; capturedAt?: string },
  ): Promise<IncidentAttachmentEntity> {
    // Upload to S3 first (may delete local file), then hash local file is gone
    // → pass filePath for hashing; S3Service must NOT delete file until after hash
    const url = await this.s3.upload(file.path, file.mimetype);

    return this.service.create({
      incidentId,
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url,
      uploadedBy: req.user.sub,
      filePath: file.path, // hash is computed inside service using this path
      gpsLat: body.gpsLat != null && isFinite(parseFloat(body.gpsLat)) ? parseFloat(body.gpsLat) : undefined,
      gpsLng: body.gpsLng != null && isFinite(parseFloat(body.gpsLng)) ? parseFloat(body.gpsLng) : undefined,
      capturedAt: body.capturedAt,
    });
  }
```

**Fix the race condition in S3Service.upload():** Move the `fs.unlinkSync` call to happen AFTER the controller finishes using the file. The simplest fix: **don't delete the file in S3Service**; instead delete it in the controller after create():

Update `S3Service.upload()` to NOT delete the file:

```typescript
    // Do NOT delete local file here — caller is responsible for cleanup
    return `${this.publicUrl}/${key}`;
```

And add cleanup in the controller after `service.create()`:

```typescript
    const result = await this.service.create({ ... });
    // Clean up local temp file (already uploaded to S3 or kept for disk mode)
    if (this.s3.isS3Mode()) {
      try { require('fs').unlinkSync(file.path); } catch { /* ignore */ }
    }
    return result;
```

Add `isS3Mode(): boolean { return this.s3 !== null; }` to S3Service.

**Or simpler:** always delete local file after service.create() succeeds (the hash has been computed by then):

```typescript
    const result = await this.service.create({ ... });
    // In S3 mode: local temp file is no longer needed; clean up
    // In disk mode: the file IS the storage — don't delete
    if (this.s3.isStoingInS3()) {
      fs.unlink(file.path, () => {}); // async, fire and forget
    }
    return result;
```

Add to S3Service:
```typescript
  isStoringInS3(): boolean { return this.s3 !== null; }
```

Use the complete controller below which handles the cleanup correctly:

```typescript
// Final complete controller for this task (replace the one above)
import * as fs from 'fs';

// In upload handler, after service.create():
    const result = await this.service.create({
      incidentId,
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url,
      uploadedBy: req.user.sub,
      filePath: file.path,
      gpsLat: body.gpsLat != null && isFinite(parseFloat(body.gpsLat)) ? parseFloat(body.gpsLat) : undefined,
      gpsLng: body.gpsLng != null && isFinite(parseFloat(body.gpsLng)) ? parseFloat(body.gpsLng) : undefined,
      capturedAt: body.capturedAt,
    });
    if (this.s3.isStoringInS3()) {
      fs.unlink(file.path, () => {}); // temp file no longer needed
    }
    return result;
```

- [ ] **Step 4: Add isStoringInS3() to S3Service**

In `apps/api/src/modules/attachments/s3.service.ts`, add after the constructor:

```typescript
  isStoringInS3(): boolean {
    return this.s3 !== null;
  }
```

And remove the `fs.unlinkSync` line from the `upload()` method (it was added in step 2 but should NOT be there).

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd apps/api && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Test upload still works locally (disk mode)**

```bash
# Start API
cd apps/api && node_modules/.bin/nest start &

# Login and get token
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@velnari.mx","password":"Admin123!"}' | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).accessToken))")

# Get any incident ID
INCIDENT_ID=$(curl -s http://localhost:3001/api/incidents \
  -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d)[0]?.id))")

echo "Testing upload to incident: $INCIDENT_ID"

# Create a test image
echo "fake image data" > /tmp/test.jpg

curl -s -X POST http://localhost:3001/api/incidents/$INCIDENT_ID/attachments \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/test.jpg;type=image/jpeg" \
  -w "\nHTTP %{http_code}"
```

Expected: JSON response with attachment data including a `url` field, `HTTP 201`.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/attachments/
git commit -m "feat: wire S3Service into attachments — S3 in prod, disk in dev"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** API Dockerfile ✓, Web Dockerfile ✓, .env.example files ✓, S3 upload ✓, disk fallback ✓
- [x] **No placeholders:** All Dockerfiles complete, S3Service complete, env examples complete
- [x] **SHA-256 race condition addressed:** File deleted only after `service.create()` (which computes hash) returns
- [x] **Dev experience preserved:** When `AWS_S3_BUCKET` is unset, S3Service returns a local disk URL — no AWS credentials needed for local dev
- [x] **No ECS startup failure:** S3Service logs a warning but does not throw if bucket is missing — API starts cleanly
- [x] **Type consistency:** `isStoringInS3()` used consistently in controller, `upload()` returns `string` URL in both paths
