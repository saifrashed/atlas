# --- Build stage -------------------------------------------------------------
FROM oven/bun:1 AS build
WORKDIR /app

COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile

COPY . .
# Builds a standalone Node server bundle into /app/dist-node
RUN bunx vite build --config vite.docker.config.ts

# --- Runtime stage -----------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

COPY --from=build /app/dist-node ./

EXPOSE 3000
CMD ["node", "server/index.mjs"]
