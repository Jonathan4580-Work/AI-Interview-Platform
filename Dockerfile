FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS builder
COPY . .
RUN npm run prisma:generate \
  && npm run build \
  && npm run next:build \
  && mkdir -p public

FROM builder AS migrator
CMD ["npm", "run", "migrate:deploy"]

FROM builder AS pruned
RUN npm prune --omit=dev \
  && npm cache clean --force

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
RUN groupadd --system --gid 1001 aptly \
  && useradd --system --uid 1001 --gid aptly --home-dir /app --shell /usr/sbin/nologin aptly \
  && mkdir -p /tmp/aptly \
  && chown -R aptly:aptly /app /tmp/aptly

COPY --from=pruned --chown=aptly:aptly /app/package.json ./package.json
COPY --from=pruned --chown=aptly:aptly /app/package-lock.json ./package-lock.json
COPY --from=pruned --chown=aptly:aptly /app/node_modules ./node_modules
COPY --from=builder --chown=aptly:aptly /app/.next/standalone ./.next/standalone
COPY --from=builder --chown=aptly:aptly /app/.next/static ./.next/standalone/.next/static
COPY --from=builder --chown=aptly:aptly /app/public ./.next/standalone/public
COPY --from=pruned --chown=aptly:aptly /app/next.config.ts ./next.config.ts
COPY --from=pruned --chown=aptly:aptly /app/prisma ./prisma
COPY --from=pruned --chown=aptly:aptly /app/scripts ./scripts
COPY --from=pruned --chown=aptly:aptly /app/src ./src
COPY --from=pruned --chown=aptly:aptly /app/tsconfig.json ./tsconfig.json

USER aptly
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node scripts/healthcheck.mjs
CMD ["node", ".next/standalone/server.js"]
