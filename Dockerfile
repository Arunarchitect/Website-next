# syntax=docker/dockerfile:1.4

# -------- BUILD STAGE --------
FROM node:20-slim AS builder

WORKDIR /app

# Install system tools and pnpm
RUN apt-get update && apt-get install -y bash curl nano \
    && npm install -g pnpm \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency files
COPY pnpm-lock.yaml package.json ./

# Install dependencies using pnpm with cache
RUN --mount=type=cache,target=/root/.pnpm-store \
    pnpm install

# Copy app source code
COPY . .

# Build Next.js app (skip lint/type check)
RUN pnpm run build --no-lint --no-typecheck --verbose || (echo "❌ Build failed! Dropping into shell..." && bash)


# -------- RUNTIME STAGE --------
FROM node:20-slim AS runner

WORKDIR /app

# Install pnpm (runtime doesn't install anything, but just in case)
RUN npm install -g pnpm

# Copy dependency manifest (for transparency)
COPY package.json pnpm-lock.yaml ./

# Copy production node_modules and built app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.* ./


# Expose port and start the app
EXPOSE 3000
CMD ["pnpm", "start"]
