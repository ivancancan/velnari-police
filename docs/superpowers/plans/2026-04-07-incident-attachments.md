# Incident Attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to upload photos and documents to incidents; files stored in S3 (or local disk in dev); displayed in the incident detail panel.

**Architecture:** New `incident_attachments` table stores metadata (id, incidentId, filename, url, uploadedBy). A dedicated `AttachmentsModule` exposes `POST /incidents/:id/attachments` (multipart/form-data) and `GET /incidents/:id/attachments`. In dev, files are saved to `./uploads/` on disk using `multer`. In prod, swap `multer.diskStorage` for `multer-s3`. The web app adds a file upload button + attachment list to `IncidentDetail.tsx`.

**Tech Stack:** NestJS + TypeORM + multer (API), Next.js 14 + React + Tailwind (web), Jest (tests).

---

## File Structure

**New files:**
- `apps/api/src/entities/incident-attachment.entity.ts` — attachment metadata entity
- `apps/api/src/database/migrations/004_attachments.ts` — migration
- `apps/api/src/modules/attachments/attachments.service.ts` — findByIncident, create, delete
- `apps/api/src/modules/attachments/attachments.controller.ts` — upload + list endpoints
- `apps/api/src/modules/attachments/attachments.module.ts`
- `apps/api/src/modules/attachments/attachments.service.spec.ts`

**Modified files:**
- `apps/api/src/app.module.ts` — import AttachmentsModule
- `apps/web/src/lib/types.ts` — add `Attachment` interface
- `apps/web/src/lib/api.ts` — add `attachmentsApi`
- `apps/web/src/components/incidents/IncidentDetail.tsx` — add upload + list UI

---

## Task 1: Database — attachment entity + migration

**Files:**
- Create: `apps/api/src/entities/incident-attachment.entity.ts`
- Create: `apps/api/src/database/migrations/004_attachments.ts`

- [ ] **Step 1: Create attachment entity**

Create `apps/api/src/entities/incident-attachment.entity.ts`:

```typescript
// apps/api/src/entities/incident-attachment.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { IncidentEntity } from './incident.entity';
import { UserEntity } from './user.entity';

@Entity('incident_attachments')
export class IncidentAttachmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'incident_id', type: 'uuid' })
  incidentId!: string;

  @ManyToOne(() => IncidentEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'incident_id' })
  incident?: IncidentEntity;

  @Column()
  filename!: string;

  @Column({ name: 'original_name' })
  originalName!: string;

  @Column()
  mimetype!: string;

  @Column({ type: 'int' })
  size!: number;

  @Column()
  url!: string;

  @Column({ name: 'uploaded_by', type: 'uuid' })
  uploadedBy!: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'uploaded_by' })
  uploader?: UserEntity;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
```

- [ ] **Step 2: Create migration**

Create `apps/api/src/database/migrations/004_attachments.ts`:

```typescript
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Attachments1704240000000 implements MigrationInterface {
  name = 'Attachments1704240000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "incident_attachments" (
        "id"            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "incident_id"   UUID NOT NULL REFERENCES "incidents"("id") ON DELETE CASCADE,
        "filename"      VARCHAR NOT NULL,
        "original_name" VARCHAR NOT NULL,
        "mimetype"      VARCHAR NOT NULL,
        "size"          INTEGER NOT NULL,
        "url"           VARCHAR NOT NULL,
        "uploaded_by"   UUID NOT NULL REFERENCES "users"("id"),
        "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_attachments_incident" ON "incident_attachments" ("incident_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "incident_attachments"`);
  }
}
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari" && git add apps/api/src/entities/incident-attachment.entity.ts apps/api/src/database/migrations/004_attachments.ts && git commit -m "feat: add incident_attachments entity and migration"
```

---

## Task 2: Backend — AttachmentsService + Controller + Module

**Files:**
- Create: `apps/api/src/modules/attachments/attachments.service.ts`
- Create: `apps/api/src/modules/attachments/attachments.controller.ts`
- Create: `apps/api/src/modules/attachments/attachments.module.ts`
- Create: `apps/api/src/modules/attachments/attachments.service.spec.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/attachments/attachments.service.spec.ts`:

```typescript
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { AttachmentsService } from './attachments.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IncidentAttachmentEntity } from '../../entities/incident-attachment.entity';

describe('AttachmentsService', () => {
  let service: AttachmentsService;

  const mockAttachment = {
    id: 'att-uuid-1',
    incidentId: 'inc-uuid-1',
    filename: 'abc123.jpg',
    originalName: 'photo.jpg',
    mimetype: 'image/jpeg',
    size: 204800,
    url: '/uploads/abc123.jpg',
    uploadedBy: 'user-uuid-1',
    createdAt: new Date(),
  };

  const mockRepo = {
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttachmentsService,
        { provide: getRepositoryToken(IncidentAttachmentEntity), useValue: mockRepo },
      ],
    }).compile();
    service = module.get<AttachmentsService>(AttachmentsService);
    jest.clearAllMocks();
  });

  it('findByIncident returns attachments for incident', async () => {
    mockRepo.find.mockResolvedValue([mockAttachment]);
    const result = await service.findByIncident('inc-uuid-1');
    expect(result).toHaveLength(1);
    expect(mockRepo.find).toHaveBeenCalledWith({
      where: { incidentId: 'inc-uuid-1' },
      order: { createdAt: 'ASC' },
    });
  });

  it('create saves attachment metadata', async () => {
    mockRepo.create.mockReturnValue(mockAttachment);
    mockRepo.save.mockResolvedValue(mockAttachment);
    const result = await service.create({
      incidentId: 'inc-uuid-1',
      filename: 'abc123.jpg',
      originalName: 'photo.jpg',
      mimetype: 'image/jpeg',
      size: 204800,
      url: '/uploads/abc123.jpg',
      uploadedBy: 'user-uuid-1',
    });
    expect(result.filename).toBe('abc123.jpg');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/api" && npx jest attachments.service.spec --no-coverage 2>&1 | tail -5
```

Expected: FAIL — `Cannot find module './attachments.service'`

- [ ] **Step 3: Create AttachmentsService**

Create `apps/api/src/modules/attachments/attachments.service.ts`:

```typescript
// apps/api/src/modules/attachments/attachments.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IncidentAttachmentEntity } from '../../entities/incident-attachment.entity';

interface CreateAttachmentInput {
  incidentId: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  url: string;
  uploadedBy: string;
}

@Injectable()
export class AttachmentsService {
  constructor(
    @InjectRepository(IncidentAttachmentEntity)
    private readonly repo: Repository<IncidentAttachmentEntity>,
  ) {}

  findByIncident(incidentId: string): Promise<IncidentAttachmentEntity[]> {
    return this.repo.find({
      where: { incidentId },
      order: { createdAt: 'ASC' },
    });
  }

  create(input: CreateAttachmentInput): Promise<IncidentAttachmentEntity> {
    const attachment = this.repo.create(input);
    return this.repo.save(attachment);
  }

  delete(id: string): Promise<void> {
    return this.repo.delete(id).then(() => undefined);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/api" && npx jest attachments.service.spec --no-coverage 2>&1 | tail -5
```

Expected: PASS — 2 tests passed.

- [ ] **Step 5: Install multer**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/api" && pnpm add multer @types/multer 2>&1 | tail -5
```

- [ ] **Step 6: Create AttachmentsController**

Create `apps/api/src/modules/attachments/attachments.controller.ts`:

```typescript
// apps/api/src/modules/attachments/attachments.controller.ts
import {
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
  constructor(private readonly service: AttachmentsService) {}

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
  ): Promise<IncidentAttachmentEntity> {
    const API_URL = process.env['API_URL'] ?? 'http://localhost:3001';
    return this.service.create({
      incidentId,
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url: `${API_URL}/uploads/${file.filename}`,
      uploadedBy: req.user.sub,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.delete(id);
  }
}
```

- [ ] **Step 7: Create AttachmentsModule**

Create `apps/api/src/modules/attachments/attachments.module.ts`:

```typescript
// apps/api/src/modules/attachments/attachments.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { IncidentAttachmentEntity } from '../../entities/incident-attachment.entity';
import { AttachmentsService } from './attachments.service';
import { AttachmentsController } from './attachments.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([IncidentAttachmentEntity]),
    MulterModule.register({}),
  ],
  controllers: [AttachmentsController],
  providers: [AttachmentsService],
})
export class AttachmentsModule {}
```

Also create the uploads directory:

```bash
mkdir -p "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/api/uploads" && touch "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/api/uploads/.gitkeep"
```

Add to `.gitignore` in `apps/api/`:
```
uploads/*
!uploads/.gitkeep
```

- [ ] **Step 8: Install @nestjs/serve-static to serve uploaded files**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/api" && pnpm add @nestjs/serve-static 2>&1 | tail -5
```

- [ ] **Step 9: Register in app.module.ts**

Read `apps/api/src/app.module.ts`. Add these imports and modules:

```typescript
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AttachmentsModule } from './modules/attachments/attachments.module';
```

Add to the imports array:
```typescript
AttachmentsModule,
ServeStaticModule.forRoot({
  rootPath: join(__dirname, '..', 'uploads'),
  serveRoot: '/uploads',
}),
```

- [ ] **Step 10: Verify TypeScript compiles**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/api" && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 11: Commit**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari" && git add apps/api/src/modules/attachments/ apps/api/src/app.module.ts apps/api/uploads/.gitkeep && git commit -m "feat: add AttachmentsModule with file upload and static serving"
```

---

## Task 3: Web — Attachment type + API + IncidentDetail UI

**Files:**
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/components/incidents/IncidentDetail.tsx`

- [ ] **Step 1: Add Attachment type to types.ts**

Open `apps/web/src/lib/types.ts`. Append:

```typescript
export interface Attachment {
  id: string;
  incidentId: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  url: string;
  uploadedBy: string;
  createdAt: string;
}
```

- [ ] **Step 2: Add attachmentsApi to api.ts**

Open `apps/web/src/lib/api.ts`. Add `Attachment` to the types import. Add at the end of the file:

```typescript
// ─── Attachments ─────────────────────────────────────────────────────────────

export const attachmentsApi = {
  getByIncident: (incidentId: string) =>
    api.get<Attachment[]>(`/incidents/${incidentId}/attachments`),

  upload: (incidentId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<Attachment>(`/incidents/${incidentId}/attachments`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  delete: (incidentId: string, id: string) =>
    api.delete(`/incidents/${incidentId}/attachments/${id}`),
};
```

- [ ] **Step 3: Add attachment section to IncidentDetail.tsx**

Read `apps/web/src/components/incidents/IncidentDetail.tsx` fully.

Add a `useEffect` to load attachments when incident id changes, and add an attachment list + upload button below the events section. The full additions (add these after the existing state declarations and useEffect hooks):

```tsx
// Add these imports at the top of the file:
import { attachmentsApi } from '@/lib/api';
import type { Attachment } from '@/lib/types';

// Add these state variables inside the component:
const [attachments, setAttachments] = useState<Attachment[]>([]);
const [uploading, setUploading] = useState(false);

// Add this useEffect alongside the existing ones:
useEffect(() => {
  if (!incident?.id) return;
  attachmentsApi.getByIncident(incident.id)
    .then((res) => setAttachments(res.data))
    .catch(console.error);
}, [incident?.id]);

// Add this handler:
async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file || !incident?.id) return;
  setUploading(true);
  try {
    const res = await attachmentsApi.upload(incident.id, file);
    setAttachments((prev) => [...prev, res.data]);
  } catch (err) {
    console.error(err);
  } finally {
    setUploading(false);
    e.target.value = '';
  }
}
```

Add this JSX block after the events list in the return statement:

```tsx
{/* Attachments section */}
<div className="mt-4">
  <div className="flex items-center justify-between mb-2">
    <h4 className="text-xs font-semibold text-slate-gray uppercase tracking-wide">
      Archivos adjuntos
    </h4>
    <label className="cursor-pointer text-xs text-tactical-blue hover:underline">
      {uploading ? 'Subiendo...' : '+ Adjuntar'}
      <input
        type="file"
        accept="image/*,application/pdf,.doc,.docx"
        className="hidden"
        onChange={handleFileUpload}
        disabled={uploading}
      />
    </label>
  </div>

  {attachments.length === 0 ? (
    <p className="text-xs text-slate-gray">Sin archivos adjuntos.</p>
  ) : (
    <div className="space-y-1">
      {attachments.map((att) => (
        <a
          key={att.id}
          href={att.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-xs text-signal-white hover:text-tactical-blue group"
        >
          <span className="text-slate-gray">
            {att.mimetype.startsWith('image/') ? '🖼' : '📄'}
          </span>
          <span className="truncate">{att.originalName}</span>
          <span className="text-slate-gray ml-auto">
            {(att.size / 1024).toFixed(0)} KB
          </span>
        </a>
      ))}
    </div>
  )}
</div>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/web" && npx tsc --noEmit 2>&1 | head -15
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari" && git add apps/web/src/lib/types.ts apps/web/src/lib/api.ts apps/web/src/components/incidents/IncidentDetail.tsx && git commit -m "feat: add attachment upload and list to incident detail"
```

---

## Self-Review

**Spec coverage:**
- ✅ Upload files — `POST /incidents/:id/attachments` with multer disk storage
- ✅ List attachments — `GET /incidents/:id/attachments` + displayed in IncidentDetail
- ✅ Delete attachments — `DELETE /incidents/:id/attachments/:id`
- ✅ Static file serving — `ServeStaticModule` serves `/uploads/*`
- ✅ File size limit — 10MB in multer config
- ✅ Accepted types — `accept="image/*,application/pdf,.doc,.docx"` in input
- ✅ Migration — `004_attachments.ts` with ON DELETE CASCADE

**Placeholder scan:** None.

**Type consistency:** `Attachment` interface matches `IncidentAttachmentEntity` fields ✅
