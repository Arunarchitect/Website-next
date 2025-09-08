# -------- BUILD STAGE --------
FROM node:20-slim AS builder

WORKDIR /app

# Install system deps for debugging & build
RUN apt-get update && apt-get install -y bash curl nano \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency files
COPY package*.json ./

# Install all dependencies (with dev, clean install)
RUN npm ci

# Copy app source
COPY . .

# Build Next.js app WITHOUT linting and type checking
RUN npm run build --no-lint --no-typecheck --verbose || (echo "❌ Build failed! Dropping into shell..." && bash)


# -------- RUNTIME STAGE --------
FROM node:20-slim AS runner

WORKDIR /app

# Copy only package.json for clarity (no install here!)
COPY package*.json ./

# Copy production node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy built app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.* ./

# Expose port
EXPOSE 3000

# Start the Next.js app
CMD ["npm", "start"]
