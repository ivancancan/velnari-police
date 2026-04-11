# Pin pnpm Version in Dockerfiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `pnpm@latest` with a pinned version in both Dockerfiles so CI builds are deterministic and cannot break due to a pnpm major bump.

**Architecture:** One-liner edit in each Dockerfile. No logic changes. Choose `pnpm@9.12.0` as a stable 9.x release compatible with the existing `pnpm-lock.yaml`.

**Tech Stack:** Docker, corepack, pnpm.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/api/Dockerfile` | Modify | Pin pnpm version on lines 3 and 21 |
| `apps/web/Dockerfile` | Modify | Pin pnpm version on line 2 |

---

### Task 1: Pin pnpm in apps/api/Dockerfile

**Files:**
- Modify: `apps/api/Dockerfile`

The file currently has `pnpm@latest` on two lines: the `base` stage (line 3) and the `runner` stage (line 21).

- [ ] **Step 1: Edit apps/api/Dockerfile**

Replace both occurrences of `pnpm@latest` with `pnpm@9.12.0`:

```dockerfile
# Before (line 3):
RUN corepack enable && corepack prepare pnpm@latest --activate

# After:
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
```

Apply to **both** the `base` stage (near top) and the `runner` stage (near bottom). The file has exactly two `corepack prepare` lines.

- [ ] **Step 2: Verify**

```bash
grep "pnpm@" apps/api/Dockerfile
```

Expected output (exactly 2 lines):
```
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
```

No line should contain `pnpm@latest`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/Dockerfile
git commit -m "chore: pin pnpm@9.12.0 in API Dockerfile for deterministic builds"
```

---

### Task 2: Pin pnpm in apps/web/Dockerfile

**Files:**
- Modify: `apps/web/Dockerfile`

The web Dockerfile has `pnpm@latest` only in the `base` stage (line 2). The `runner` stage uses the Node image directly without reinstalling pnpm.

- [ ] **Step 1: Edit apps/web/Dockerfile**

Replace `pnpm@latest` with `pnpm@9.12.0`:

```dockerfile
# Before (line 2):
RUN corepack enable && corepack prepare pnpm@latest --activate

# After:
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
```

- [ ] **Step 2: Verify**

```bash
grep "pnpm@" apps/web/Dockerfile
```

Expected (exactly 1 line):
```
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/Dockerfile
git commit -m "chore: pin pnpm@9.12.0 in web Dockerfile for deterministic builds"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Both Dockerfiles updated ✓
- [x] **No placeholders:** Exact version specified (`9.12.0`) ✓
- [x] **No logic changes:** Pure string substitution — zero risk ✓
- [x] **Version choice:** pnpm 9.x is the current stable major, compatible with existing lockfile ✓
