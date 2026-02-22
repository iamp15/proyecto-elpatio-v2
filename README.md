# El Patio v2

Plataforma de juegos clásicos (Ludo, Dominó, etc.) integrada en Telegram como Mini App. Club Social Virtual con economía en "Piedras" y Telegram Stars/TON.

**Repositorio**: [github.com/iamp15/proyecto-elpatio-v2](https://github.com/iamp15/proyecto-elpatio-v2)

## Monorepo

Este proyecto es un **monorepo** con npm workspaces. Todas las apps y paquetes comparten la raíz:

- **apps/webapp** — Mini App Telegram (React + Vite)
- **apps/dashboard** — Panel admin (React + Vite)
- **apps/api-gateway** — Backend Express + MongoDB
- **apps/game-server** — Socket.io, tiempo real
- **apps/bot-telegram** — Bot de Telegram
- **packages/shared-types** — Tipos TypeScript compartidos

Desde la raíz puedes instalar dependencias de todo el monorepo con `npm install` y usar los scripts `dev:*` y `build:*`. Si ya tenías `node_modules` en cada app, puedes borrarlos y ejecutar solo `npm install` en la raíz.

## Arquitectura

- **Webapp**: Mini App de Telegram (React + Vite) — frontend de juegos, corre dentro de Telegram.
- **Dashboard**: Panel de administración (React + Vite) — monitoreo y configuración, se abre en cualquier navegador.
- **API Gateway**: Backend (Express + MongoDB) — auth, saldos (Piedras), pagos.
- **Game Server**: Socket.io — tiempo real, lógica de partidas (Ludo, Dominó).
- **Bot Telegram**: Punto de entrada, notificaciones, enlace a la Mini App.

Cada servicio es independiente y tiene su propio `package.json` y lógica.

## Desarrollo local

1. Clonar e instalar (solo la primera vez):
   ```bash
   git clone https://github.com/iamp15/proyecto-elpatio-v2.git
   cd proyecto-elpatio-v2
   npm install
   ```
   Con workspaces, `npm install` en la raíz instala dependencias de todas las apps y packages.
2. Copiar `.env.example` a `.env` y rellenar variables (tokens, URIs).
3. Levantar servicios con Docker:
   ```bash
   docker-compose up -d
   ```
   Esto levanta: MongoDB, API Gateway, Game Server, Bot Telegram.
4. Frontends en local (recomendado para hot-reload):
   ```bash
   npm run dev:webapp
   npm run dev:dashboard
   ```
   O desde cada carpeta: `cd apps/webapp && npm run dev`, `cd apps/dashboard && npm run dev`.
5. Scripts desde raíz (opcional):
   ```bash
   npm run dev:api
   npm run dev:game
   npm run dev:bot
   ```

## Producción

| Servicio      | Dónde   |
|---------------|---------|
| Webapp        | Vercel  |
| Dashboard     | Vercel  |
| API Gateway   | Fly.io  |
| Game Server   | Fly.io  |
| Bot Telegram  | Fly.io  |
| Base de datos | MongoDB Atlas |

## Subir a GitHub

El remoto ya está configurado. Para el primer push:

```bash
git add .
git commit -m "Initial commit: monorepo El Patio v2"
git branch -M main
git push -u origin main
```

## Documentación

Ver [docs/Proyecto El Patio v2.0.pdf](docs/Proyecto%20El%20Patio%20v2.0.pdf) para visión general, economía y pilares del proyecto.
