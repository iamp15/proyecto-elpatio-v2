FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/game-server/package.json ./apps/game-server/
COPY apps/api-gateway/package.json ./apps/api-gateway/
COPY apps/bot-telegram/package.json ./apps/bot-telegram/
COPY apps/webapp/package.json ./apps/webapp/
COPY apps/dashboard/package.json ./apps/dashboard/
COPY packages/database/package.json ./packages/database/
COPY packages/shared-types/package.json ./packages/shared-types/
RUN npm install --omit=dev

FROM base AS runner
COPY --from=deps /app/node_modules ./node_modules
COPY apps/game-server ./apps/game-server
ENV NODE_ENV=production
WORKDIR /app/apps/game-server
EXPOSE 3001
CMD ["node", "socket-handler.js"]
