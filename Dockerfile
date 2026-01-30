# syntax=docker/dockerfile:1

# ===============================
# Base stage (Debian-slim for better native module support)
# ===============================
FROM node:20-slim AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.10.0 --activate

WORKDIR /app

# ===============================
# Dependencies stage
# ===============================
FROM base AS deps

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# ===============================
# Builder stage
# ===============================
FROM base AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Build the Next.js app (standalone mode)
RUN pnpm exec next build

# Create sqlite database
RUN pnpm exec drizzle-kit push --dialect sqlite --schema src/server/database/schema.ts --url file:.next/standalone/resend-local.sqlite

# Build the Docker-specific starter script using esbuild (bundle commander included, CJS format)
RUN pnpm exec esbuild docker-starter.ts \
    --bundle \
    --platform=node \
    --target=node20 \
    --format=cjs \
    --outfile=.next/standalone/starter.cjs \
    --banner:js='#! /usr/bin/env node'

# Copy static files
RUN cp -r .next/static .next/standalone/.next/static && \
    cp -r public .next/standalone/public

# ===============================
# Production stage (Debian-slim for libsql native modules)
# ===============================
FROM node:20-slim AS runner

# Install pnpm for installing native modules
RUN corepack enable && corepack prepare pnpm@10.10.0 --activate

WORKDIR /app

# Create non-root user for security
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs nextjs

# Copy the built standalone application (includes node_modules)
COPY --from=builder /app/.next/standalone ./

# Install @libsql/client native modules directly in production
# This ensures the correct platform binaries are installed
RUN pnpm add @libsql/client@0.15.14 --ignore-workspace

# Set proper permissions for the sqlite database directory
RUN chown -R nextjs:nodejs /app

USER nextjs

# Expose the default port (can be overridden at runtime)
EXPOSE 8005

# Environment variables (PORT can be overridden at runtime)
ENV NODE_ENV=production
ENV PORT=8005

# Health check using the PORT environment variable
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:${PORT}/dashboard', (r) => process.exit(r.statusCode === 200 || r.statusCode === 307 ? 0 : 1)).on('error', () => process.exit(1))"

# Start the application with configurable port
# Usage: docker run -e PORT=3000 -p 3000:3000 resend-local
ENTRYPOINT ["node", "starter.cjs"]
CMD ["-p", "8005"]
