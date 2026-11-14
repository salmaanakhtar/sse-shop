# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
RUN corepack enable
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

# ── dependencies ──────────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# ── build ─────────────────────────────────────────────────────────────────────
FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_BUILD_TARGET=docker
ENV NEXT_TELEMETRY_DISABLED=1
# Build-time only, and scoped to this command so nothing is baked into the image
# config. No database connection is opened during `next build`.
RUN DATABASE_URL=postgres://build:build@localhost:5432/build \
    BETTER_AUTH_SECRET=build-time-placeholder-value-not-used-at-runtime \
    BETTER_AUTH_URL=http://localhost:3000 \
    pnpm build

# ── runtime ───────────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=build --chown=nextjs:nodejs /app/scripts/migrate.mjs ./scripts/migrate.mjs

RUN mkdir -p /data/uploads && chown -R nextjs:nodejs /data

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["sh", "-c", "node scripts/migrate.mjs && node server.js"]
