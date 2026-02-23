FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/bot-telegram/package.json ./apps/bot-telegram/
COPY apps/api-gateway/package.json ./apps/api-gateway/
COPY apps/game-server/package.json ./apps/game-server/
COPY apps/webapp/package.json ./apps/webapp/
COPY apps/dashboard/package.json ./apps/dashboard/
COPY packages/database/package.json ./packages/database/
COPY packages/shared-types/package.json ./packages/shared-types/
RUN npm install --omit=dev

FROM base AS runner
COPY --from=deps /app/node_modules ./node_modules
COPY apps/bot-telegram ./apps/bot-telegram
ENV NODE_ENV=production
WORKDIR /app/apps/bot-telegram
CMD ["node", "src/index.js"]
