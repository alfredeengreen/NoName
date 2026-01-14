# Production Dockerfile for Collector Service
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY apps/collector/package.json ./apps/collector/
COPY apps/script/package.json ./apps/script/

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# Install dependencies
RUN pnpm install

# Build packages
FROM base AS builder
WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# Copy workspace root files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source files only (exclude node_modules)
COPY packages/db/src ./packages/db/src
COPY packages/db/package.json packages/db/tsconfig.json ./packages/db/
COPY packages/shared/src ./packages/shared/src
COPY packages/shared/package.json packages/shared/tsconfig.json ./packages/shared/
COPY apps/collector/src ./apps/collector/src
COPY apps/collector/package.json apps/collector/tsconfig.json ./apps/collector/
COPY apps/script ./apps/script

# Build packages, collector, and script using workspace build
WORKDIR /app
# Reinstall to ensure workspace links are correct
RUN pnpm install --frozen-lockfile=false && \
    pnpm --filter @analytics/shared build && \
    pnpm --filter @analytics/db build && \
    pnpm --filter @analytics/script build && \
    pnpm --filter @analytics/collector build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install pnpm for production install
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 collector

# Copy workspace root files
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

# Copy package.json files
COPY --from=builder /app/packages/db/package.json ./packages/db/
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/apps/collector/package.json ./apps/collector/

# Install production dependencies
RUN pnpm install --prod --frozen-lockfile=false

# Copy built files
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/collector/dist ./apps/collector/dist

# Copy script bundle (must be built in builder stage)
COPY --from=builder /app/apps/script/dist/analytics.js ./apps/script/dist/analytics.js

# Copy VERSION file if it exists, otherwise create it
RUN if [ -f /app/VERSION ]; then cp /app/VERSION ./VERSION; else echo "1.0.0" > ./VERSION; fi

USER collector

EXPOSE 3001

ENV PORT=3001
ENV HOST=0.0.0.0

WORKDIR /app/apps/collector
CMD ["node", "dist/server.js"]

