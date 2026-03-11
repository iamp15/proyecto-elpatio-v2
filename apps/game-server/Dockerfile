FROM node:20-alpine AS base
WORKDIR /app

# ── Stage 1: instalar dependencias ───────────────────────────────────────────
FROM base AS deps

# Manifiestos del workspace raíz y de los paquetes que usa el game-server
COPY package.json package-lock.json* ./
COPY packages/database/package.json ./packages/database/
COPY apps/game-server/package.json ./apps/game-server/

# npm workspaces crea un symlink node_modules/@el-patio/database → ../../packages/database
# Solo necesita los package.json para resolver el grafo de dependencias.
RUN npm install --omit=dev

# ── Stage 2: imagen de producción ────────────────────────────────────────────
FROM base AS runner

# node_modules contiene el symlink: node_modules/@el-patio/database → ../../packages/database
COPY --from=deps /app/node_modules ./node_modules

# Copiar el destino real del symlink para que require('@el-patio/database') resuelva
COPY packages/database ./packages/database

# Código fuente de la app
COPY apps/game-server ./apps/game-server

ENV NODE_ENV=production
WORKDIR /app/apps/game-server
EXPOSE 3001
CMD ["node", "socket-handler.js"]
