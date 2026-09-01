# ---------- Builder ----------
FROM node:24-slim AS builder

WORKDIR /app

# Pin pnpm to match your local version (avoids v10/v11 config-reading mismatches)
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Production-safe
RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm build

# ---------- Runner ----------
FROM node:24-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]