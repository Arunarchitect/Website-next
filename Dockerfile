# -------- BUILD STAGE --------
FROM node:20-slim AS builder

WORKDIR /app

# Install system deps for debugging & build, and latest pnpm
RUN apt-get update && apt-get install -y bash curl nano \
    && npm install -g pnpm@latest \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency files
COPY pnpm-lock.yaml package.json ./

# Install all dependencies using pnpm
RUN pnpm install --no-frozen-lockfile

# 🔐 Security audit and auto‑fix vulnerabilities
# First, show the audit report (optional, doesn't fail build)
RUN pnpm audit || true
# Then attempt to automatically fix vulnerabilities (will fail build if fix fails)
RUN pnpm audit --fix

# Copy ALL source files
COPY . .

ENV NEXT_DISABLE_TYPECHECK=1
ENV NEXT_DISABLE_ESLINT=1

# Build Next.js app using pnpm
RUN pnpm run build || (echo "❌ Build failed! Dropping into shell..." && bash)

# -------- RUNTIME STAGE --------
FROM node:20-slim AS runner

WORKDIR /app

# 🔧 FIX: Install pkill (procps) so that spawn pkill works
RUN apt-get update && apt-get install -y procps && rm -rf /var/lib/apt/lists/*

# Install pnpm globally
RUN npm install -g pnpm

# Copy the **updated** package.json from builder (after audit fixes)
COPY --from=builder /app/package.json ./

# Copy production node_modules and built app from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.* ./

# Expose port and start the app using pnpm
EXPOSE 3000
CMD ["pnpm", "start"]