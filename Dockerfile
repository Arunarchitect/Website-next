# -------- BUILD STAGE --------
FROM node:20-slim AS builder

WORKDIR /app

# Install system deps for debugging & build
RUN apt-get update && apt-get install -y bash curl nano \
    && npm install -g pnpm \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency files
COPY pnpm-lock.yaml package.json ./

# Install all dependencies using pnpm
RUN pnpm install --frozen-lockfile

# Copy app source
COPY . .

# Build Next.js app using pnpm
RUN pnpm run build || (echo "❌ Build failed! Dropping into shell..." && bash)

# -------- RUNTIME STAGE --------
FROM node:20-slim AS runner

WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy dependency files
COPY package.json pnpm-lock.yaml ./

# Copy production node_modules and built app from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.* ./

# Expose port and start the app using pnpm
EXPOSE 3000
CMD ["pnpm", "start"]
