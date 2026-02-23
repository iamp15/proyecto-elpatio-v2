FROM node:20-alpine AS base
WORKDIR /app

# --- PASO 1: Instalar dependencias ---
FROM base AS deps
# Copiamos los package.json de la raíz y de los paquetes que este servicio necesita
COPY package.json package-lock.json* ./
COPY packages/database/package.json ./packages/database/
COPY apps/api-gateway/package.json ./apps/api-gateway/

# Instalamos (incluyendo los links entre paquetes locales)
RUN npm install

# --- PASO 2: Ejecución ---
FROM base AS runner
# Copiamos solo los node_modules instalados en el paso anterior
COPY --from=deps /app/node_modules ./node_modules

# COPIA SELECTIVA: Solo lo que este servicio necesita para correr
COPY packages/database ./packages/database
COPY apps/api-gateway ./apps/api-gateway

# Seteamos variables de entorno
ENV NODE_ENV=production
EXPOSE 3000

# Nos movemos a la carpeta del gateway para ejecutar
WORKDIR /app/apps/api-gateway

# Ajustamos la ruta al archivo de arranque (asegúrate que sea src/index.js o server.js)
CMD ["node", "src/index.js"]