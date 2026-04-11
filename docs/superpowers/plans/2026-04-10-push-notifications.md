# Push Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send an Expo push notification to the assigned officer's device whenever `dispatch.service.ts` assigns or reassigns them to an incident.

**Architecture:** Mobile registers its Expo push token after login via `PATCH /auth/push-token` (authenticated, no role restriction). The token is stored in `users.expo_push_token`. `DispatchService` injects `NotificationsService`, which calls the Expo Push API via `fetch` after a successful assignment.

**Tech Stack:** NestJS fetch (native Node 18+), Expo Push API (`https://exp.host/--/api/v2/push/send`), TypeORM migration, `expo-notifications` (already installed in mobile).

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/api/src/database/migrations/014_push_tokens.ts` | Create | Add `expo_push_token` column to users |
| `apps/api/src/entities/user.entity.ts` | Modify | Add `expoPushToken` field |
| `apps/api/src/modules/notifications/notifications.service.ts` | Create | Call Expo Push API via fetch |
| `apps/api/src/modules/notifications/notifications.module.ts` | Create | Export NotificationsService |
| `apps/api/src/modules/auth/auth.controller.ts` | Modify | Add `PATCH /auth/push-token` endpoint |
| `apps/api/src/modules/auth/auth.service.ts` | Modify | Add `updatePushToken(userId, token)` |
| `apps/api/src/modules/dispatch/dispatch.service.ts` | Modify | Call notifications after assign/reassign |
| `apps/api/src/modules/dispatch/dispatch.module.ts` | Modify | Import NotificationsModule |
| `apps/mobile/src/lib/api.ts` | Modify | Add `authApi.updatePushToken(token)` |
| `apps/mobile/app/login.tsx` | Modify | After login: register token and send to backend |

---

### Task 1: DB Migration — add expo_push_token to users

**Files:**
- Create: `apps/api/src/database/migrations/014_push_tokens.ts`

- [ ] **Step 1: Write the migration**

```typescript
// apps/api/src/database/migrations/014_push_tokens.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class PushTokens1712986000014 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS expo_push_token VARCHAR(512);
      CREATE INDEX IF NOT EXISTS idx_users_expo_push_token ON users(expo_push_token) WHERE expo_push_token IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_users_expo_push_token;
      ALTER TABLE users DROP COLUMN IF EXISTS expo_push_token;
    `);
  }
}
```

- [ ] **Step 2: Run migration**

```bash
cd apps/api && pnpm db:migrate
```

Expected output: `Migration PushTokens1712986000014 has been executed successfully.`

- [ ] **Step 3: Verify column exists**

```bash
cd apps/api && node -e "
const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL || 'postgresql://velnari:velnari_dev@localhost:5432/velnari_dev' });
c.connect().then(() => c.query(\"SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='expo_push_token'\")).then(r => { console.log(r.rows); c.end(); });
"
```

Expected: `[ { column_name: 'expo_push_token' } ]`

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/database/migrations/014_push_tokens.ts
git commit -m "feat: migration 014 — add expo_push_token to users"
```

---

### Task 2: Add expoPushToken field to UserEntity

**Files:**
- Modify: `apps/api/src/entities/user.entity.ts`

- [ ] **Step 1: Add the column after `shift`**

In `apps/api/src/entities/user.entity.ts`, add after the `shift` column:

```typescript
  @Column({ name: 'expo_push_token', nullable: true, length: 512 })
  expoPushToken?: string;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/api && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/entities/user.entity.ts
git commit -m "feat: add expoPushToken to UserEntity"
```

---

### Task 3: NotificationsService — Expo Push API caller

**Files:**
- Create: `apps/api/src/modules/notifications/notifications.service.ts`
- Create: `apps/api/src/modules/notifications/notifications.module.ts`

- [ ] **Step 1: Create NotificationsService**

```typescript
// apps/api/src/modules/notifications/notifications.service.ts
import { Injectable, Logger } from '@nestjs/common';

interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  sound?: 'default';
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  async sendPush(token: string | null | undefined, message: Omit<ExpoMessage, 'to'>): Promise<void> {
    if (!token || !token.startsWith('ExponentPushToken[')) {
      return; // not a valid expo token — skip silently
    }

    const payload: ExpoMessage = { to: token, ...message };

    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json() as { data?: { status: string; message?: string } };
      if (json.data?.status === 'error') {
        this.logger.warn(`Expo push error for token ${token.slice(0, 30)}: ${json.data.message}`);
      }
    } catch (err) {
      // Push is best-effort — never throw
      this.logger.error(`Failed to send push notification: ${(err as Error).message}`);
    }
  }
}
```

- [ ] **Step 2: Create NotificationsModule**

```typescript
// apps/api/src/modules/notifications/notifications.module.ts
import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Module({
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/api && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/notifications/
git commit -m "feat: NotificationsService — Expo Push API caller"
```

---

### Task 4: Backend endpoint — PATCH /auth/push-token

**Files:**
- Modify: `apps/api/src/modules/auth/auth.service.ts`
- Modify: `apps/api/src/modules/auth/auth.controller.ts`

- [ ] **Step 1: Add updatePushToken to AuthService**

In `apps/api/src/modules/auth/auth.service.ts`, inject `UserRepository` (it's already injected — verify by reading the file first). Add this method:

```typescript
  async updatePushToken(userId: string, token: string): Promise<void> {
    await this.userRepo.update(userId, { expoPushToken: token });
  }
```

If `userRepo` is not available in AuthService, read `auth.service.ts` to see how users are accessed and adapt accordingly (e.g., call `this.usersService.update(userId, { expoPushToken: token })`).

- [ ] **Step 2: Add PATCH /auth/push-token to AuthController**

In `apps/api/src/modules/auth/auth.controller.ts`, add the endpoint after `me()`:

```typescript
  @Patch('push-token')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async updatePushToken(
    @CurrentUser() user: JwtPayload,
    @Body('token') token: string,
  ): Promise<void> {
    if (!token || typeof token !== 'string') return;
    await this.authService.updatePushToken(user.sub, token);
  }
```

Add `Patch` and `HttpStatus` to the import from `@nestjs/common`.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/api && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Test the endpoint manually**

```bash
# First login to get token
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@velnari.mx","password":"Admin123!"}' | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).accessToken))")

curl -s -X PATCH http://localhost:3001/api/auth/push-token \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"token":"ExponentPushToken[test-token-12345]"}' \
  -w "\nHTTP %{http_code}"
```

Expected: `HTTP 204`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/auth/auth.service.ts apps/api/src/modules/auth/auth.controller.ts
git commit -m "feat: PATCH /auth/push-token — store expo push token for authenticated user"
```

---

### Task 5: Wire notifications into DispatchService

**Files:**
- Modify: `apps/api/src/modules/dispatch/dispatch.service.ts`
- Modify: `apps/api/src/modules/dispatch/dispatch.module.ts`

- [ ] **Step 1: Update dispatch.module.ts to import NotificationsModule**

In `apps/api/src/modules/dispatch/dispatch.module.ts`, add `NotificationsModule` to the imports array:

```typescript
import { NotificationsModule } from '../notifications/notifications.module';

// inside @Module:
imports: [
  TypeOrmModule.forFeature([IncidentEventEntity, IncidentEntity, IncidentUnitAssignmentEntity, UnitEntity]),
  forwardRef(() => IncidentsModule),
  UnitsModule,
  RealtimeModule,
  NotificationsModule,  // add this
],
```

- [ ] **Step 2: Inject NotificationsService and UserRepository into DispatchService**

In `apps/api/src/modules/dispatch/dispatch.service.ts`, add to imports:

```typescript
import { NotificationsService } from '../notifications/notifications.service';
import { UserEntity } from '../../entities/user.entity';
```

Add to constructor parameters:

```typescript
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly notifications: NotificationsService,
```

Add `UserEntity` to `TypeOrmModule.forFeature([...])` in dispatch.module.ts:

```typescript
TypeOrmModule.forFeature([IncidentEventEntity, IncidentEntity, IncidentUnitAssignmentEntity, UnitEntity, UserEntity]),
```

(Note: `UnitEntity` is already there — just add `UserEntity` without duplicating.)

- [ ] **Step 3: Add sendAssignmentNotification helper and call it after assign/reassign**

In `dispatch.service.ts`, add this private helper method:

```typescript
  private async sendAssignmentNotification(unitId: string, incidentFolio: string, etaMinutes: number | null): Promise<void> {
    // Find the officer assigned to this unit
    const unit = await this.unitRepo.findOne({ where: { id: unitId } });
    if (!unit?.assignedUserId) return;
    const user = await this.userRepo.findOne({ where: { id: unit.assignedUserId } });
    if (!user?.expoPushToken) return;

    const eta = etaMinutes ? ` · ETA: ~${etaMinutes} min` : '';
    await this.notifications.sendPush(user.expoPushToken, {
      title: 'Incidente asignado',
      body: `Se te asignó ${incidentFolio}${eta}`,
      sound: 'default',
      priority: 'high',
      channelId: 'dispatch',
      data: { incidentFolio },
    });
  }
```

In `assignUnit()`, after `this.realtime.emitIncidentAssigned(...)`, add:

```typescript
    void this.sendAssignmentNotification(unitId, savedIncident.folio ?? incidentId, etaMinutes);
```

In `reassignUnit()`, after `this.realtime.emitIncidentAssigned(...)`, add:

```typescript
    void this.sendAssignmentNotification(newUnitId, saved.folio ?? incidentId, etaMinutes);
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd apps/api && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/dispatch/dispatch.service.ts apps/api/src/modules/dispatch/dispatch.module.ts
git commit -m "feat: send push notification to officer on incident assignment"
```

---

### Task 6: Mobile — send push token to backend after login

**Files:**
- Modify: `apps/mobile/src/lib/api.ts`
- Modify: `apps/mobile/app/login.tsx`

- [ ] **Step 1: Add updatePushToken to authApi in api.ts**

In `apps/mobile/src/lib/api.ts`, add to the `authApi` object:

```typescript
  updatePushToken: (token: string) =>
    api.patch('/auth/push-token', { token }),
```

- [ ] **Step 2: Update login.tsx to send token after login**

In `apps/mobile/app/login.tsx`, replace the current push notification fire-and-forget:

```typescript
      // Register for push notifications (non-blocking)
      registerForPushNotifications().catch(() => {});
```

With:

```typescript
      // Register push token and send to backend (non-blocking)
      registerForPushNotifications()
        .then((token) => { if (token) return authApi.updatePushToken(token); })
        .catch(() => {});
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/mobile && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors (or only pre-existing errors unrelated to this change).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/lib/api.ts apps/mobile/app/login.tsx
git commit -m "feat(mobile): send expo push token to backend after login"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Migration adds column ✓, entity reflects it ✓, PATCH endpoint ✓, DispatchService sends push ✓, mobile sends token ✓
- [x] **No placeholders:** All code is complete
- [x] **Type consistency:** `expoPushToken` used consistently in entity, service, and controller
- [x] **Push is best-effort:** sendPush never throws, uses `void` call-site, won't break dispatch on failure
- [x] **No admin required:** PATCH /auth/push-token uses only JwtAuthGuard — any authenticated officer can register their token
