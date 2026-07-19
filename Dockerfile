# Debian slim (glibc) so better-sqlite3 uses prebuilt binaries.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3005 \
    HOSTNAME=0.0.0.0 \
    DATABASE_PATH=/data/vitaplan.db \
    UPLOADS_DIR=/data/uploads

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# drizzle migrations run automatically on first database open
COPY --from=builder /app/drizzle ./drizzle

RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME /data
EXPOSE 3005

CMD ["node", "server.js"]
