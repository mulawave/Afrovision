# ── Build stage ────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Copy manifests only — leverage layer cache
COPY package.json package-lock.json ./

# Install production dependencies only
# Set generous timeout to avoid EIDLETIMEOUT on slow networks
RUN npm ci --omit=dev --fetch-timeout=600000 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000

# ── Runtime stage ───────────────────────────────────────────
FROM node:20-alpine AS runtime

# Install ffmpeg for thumbnail generation
RUN apk add --no-cache ffmpeg

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy installed modules from build stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY src/ ./src/
COPY package.json ./

# Persistent uploads directory (ephemeral on Cloud Run — use GCS for production)
RUN mkdir -p uploads && chown -R appuser:appgroup /app

USER appuser

# Cloud Run injects PORT automatically (defaults to 8080)
ENV PORT=8080
EXPOSE 8080

CMD ["node", "src/app.js"]
