# Production Dockerfile for Web Dashboard
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# Install dependencies
RUN pnpm install

# Build packages and app
FROM base AS builder
WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages

# Copy workspace root files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy source files
COPY packages/db/src ./packages/db/src
COPY packages/db/package.json packages/db/tsconfig.json ./packages/db/
COPY packages/shared/src ./packages/shared/src
COPY packages/shared/package.json packages/shared/tsconfig.json ./packages/shared/

# Copy apps/web excluding node_modules (use .dockerignore or copy specific dirs)
COPY apps/web/app ./apps/web/app
COPY apps/web/lib ./apps/web/lib
COPY apps/web/components ./apps/web/components
COPY apps/web/contexts ./apps/web/contexts
COPY apps/web/public ./apps/web/public
COPY apps/web/hooks ./apps/web/hooks
COPY apps/web/package.json apps/web/tsconfig.json apps/web/next.config.js apps/web/postcss.config.js apps/web/tailwind.config.js ./apps/web/

# Build packages and web app using workspace build
WORKDIR /app
# Install dependencies to ensure workspace links are correct
RUN pnpm install --frozen-lockfile=false && \
    pnpm --filter @analytics/shared build && \
    pnpm --filter @analytics/db build && \
    pnpm --filter @analytics/web build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy necessary files
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/db/package.json ./packages/db/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
# Copy standalone build - Next.js standalone includes server.js and references
COPY --from=builder /app/apps/web/.next/standalone ./
# Copy static files - standalone build needs these for CSS/JS assets
# With basePath /app, static files should be at apps/web/.next/static
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
# Also copy to standalone's expected location if different
COPY --from=builder /app/apps/web/.next/static ./.next/static
# Copy public files
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/package.json ./apps/web/

# Change ownership of all files to nextjs user
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Standalone build structure: .next/standalone/apps/web/ contains server.js
# Set working directory to where server.js is located
WORKDIR /app/apps/web
CMD ["node", "server.js"]

