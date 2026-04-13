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
# Verify dist was produced
RUN ls -la /app/apps/api/dist/

# ---------- runtime ----------
FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app
ENV NODE_ENV=production

# GIT_SHA injected at build time (CI passes --build-arg GIT_SHA=${{ github.sha }}).
# Exposed as env for health endpoint / logs / Sentry release tagging.
ARG GIT_SHA=unknown
ENV GIT_SHA=${GIT_SHA}
ARG BUILD_TIME=unknown
ENV BUILD_TIME=${BUILD_TIME}

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/ ./packages/
RUN pnpm install --frozen-lockfile --filter @velnari/api... --prod

# Copy built output from builder (cache busted: v2)
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Install curl for healthcheck (must run as root before user switch)
RUN apk add --no-cache curl

# Create uploads dir and set permissions before switching user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
RUN mkdir -p /app/apps/api/uploads && chown -R nodejs:nodejs /app/apps/api/uploads
USER nodejs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1

CMD ["node", "apps/api/dist/apps/api/src/main.js"]
