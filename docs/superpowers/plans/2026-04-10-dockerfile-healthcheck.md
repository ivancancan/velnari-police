# Dockerfile HEALTHCHECK Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `HEALTHCHECK` instruction to the API Dockerfile's runner stage so that ECS/Docker knows when the container is healthy and can route traffic safely.

**Architecture:** Install `curl` in the runner stage Alpine image, then add `HEALTHCHECK CMD curl -f http://localhost:3001/api/health || exit 1`. The `/api/health` endpoint already exists in NestJS (`@nestjs/terminus` or a simple controller). If it doesn't exist, create a minimal one.

**Tech Stack:** Docker `HEALTHCHECK`, Alpine `curl`, NestJS.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/api/Dockerfile` | Modify | Install curl + add HEALTHCHECK in runner stage |
| `apps/api/src/modules/health/health.controller.ts` | Create (if not exists) | GET /health → 200 OK |
| `apps/api/src/app.module.ts` | Modify (if health module not registered) | Register HealthModule |

---

### Task 1: Check if /api/health exists

**Files:**
- Read: `apps/api/src/`

- [ ] **Step 1: Search for existing health endpoint**

```bash
grep -r "health" apps/api/src --include="*.ts" -l
```

If `health.controller.ts` or `TerminusModule` is found, skip Task 2. If not found, proceed with Task 2.

- [ ] **Step 2: Also check app.module.ts for TerminusModule**

```bash
grep -i "terminus\|health" apps/api/src/app.module.ts
```

If found, `/api/health` already exists — skip to Task 3.

---

### Task 2: Create minimal health controller (only if /api/health does not exist)

**Files:**
- Create: `apps/api/src/modules/health/health.controller.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create the health controller**

```typescript
// apps/api/src/modules/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
```

- [ ] **Step 2: Register in AppModule**

In `apps/api/src/app.module.ts`, add `HealthController` to the `controllers` array (or create a `HealthModule` if the file uses module imports — check the file first):

```typescript
// If AppModule has a controllers array directly:
import { HealthController } from './modules/health/health.controller';

// Add to @Module controllers:
controllers: [HealthController, ...existingControllers],
```

If AppModule uses modular imports only, create a minimal module:

```typescript
// apps/api/src/modules/health/health.module.ts
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({ controllers: [HealthController] })
export class HealthModule {}
```

Then add `HealthModule` to `AppModule.imports`.

- [ ] **Step 3: Verify**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | head -10
```

Expected: no errors.

- [ ] **Step 4: Test the endpoint (requires running API)**

```bash
curl -s http://localhost:3001/api/health
```

Expected: `{"status":"ok","timestamp":"..."}`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/health/
git add apps/api/src/app.module.ts
git commit -m "feat: minimal /api/health endpoint for Docker HEALTHCHECK"
```

---

### Task 3: Add HEALTHCHECK to apps/api/Dockerfile

**Files:**
- Modify: `apps/api/Dockerfile`

The runner stage currently looks like:
```dockerfile
FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app
ENV NODE_ENV=production
...
EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
```

- [ ] **Step 1: Add curl and HEALTHCHECK**

After `EXPOSE 3001` and before `CMD`, add:

```dockerfile
RUN apk add --no-cache curl

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1
```

The full runner stage should look like:
```dockerfile
FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
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

RUN apk add --no-cache curl

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1

CMD ["node", "apps/api/dist/main.js"]
```

- [ ] **Step 2: Verify HEALTHCHECK line is present**

```bash
grep -A2 "HEALTHCHECK" apps/api/Dockerfile
```

Expected:
```
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/Dockerfile
git commit -m "chore: add HEALTHCHECK to API Dockerfile with 30s start period"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** HEALTHCHECK instruction added ✓, curl installed ✓, `/api/health` covered ✓
- [x] **No placeholders:** Full Dockerfile snippet shown ✓
- [x] **Start period:** `--start-period=30s` allows NestJS time to boot before health checks begin ✓
- [x] **Retries:** 3 retries before marking unhealthy — handles brief startup spikes ✓
- [x] **Conditional health controller:** Plan handles both "endpoint exists" and "endpoint missing" cases ✓
