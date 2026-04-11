# apps/api/Dockerfile
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
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

# Run as non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /app/apps/api/uploads
USER nodejs

EXPOSE 3001

RUN apk add --no-cache curl

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1

CMD ["node", "apps/api/dist/main.js"]
