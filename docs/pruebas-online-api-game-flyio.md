# Pruebas online: api-gateway + game-server en Fly.io

Guía paso a paso para probar en Fly.io usando Docker (misma imagen que en local con `docker-compose`).

---

## Requisitos previos

1. **Fly.io**
   - Cuenta en [fly.io](https://fly.io) y CLI instalada (`fly auth login`).
   - Ver detalles en [deploy-api-gateway-flyio.md](./deploy-api-gateway-flyio.md).

2. **MongoDB**
   - URI accesible desde internet (p. ej. MongoDB Atlas con acceso desde `0.0.0.0/0` o IPs de Fly).

3. **Variables que vas a usar**
   - `MONGO_URI`, `JWT_SECRET`
   - Para la webapp: `CORS_ORIGIN` (api-gateway) y URL del game-server (WebSocket/HTTP).

---

## Paso 0: Probar en local con Docker

Desde la **raíz del monorepo**:

```bash
docker compose up --build api-gateway game-server
```

- API: <http://localhost:3000> → `GET /health`
- Game: <http://localhost:3001> → `GET /health`

Si esto funciona, el mismo build se usará en Fly (mismo Dockerfile y contexto).

---

## Paso 1: API Gateway en Fly.io

### 1.1 Primera vez: crear la app (sin desplegar)

Desde la **raíz del monorepo**:

```bash
fly launch --config fly.api.toml --no-deploy
```

- "Create new app?" → **Yes**.
- Región → la que prefieras (ej. `gru`, `mad`).

### 1.2 Secrets del api-gateway

```bash
fly secrets set MONGO_URI="<TU_URI_ATLAS>" --app el-patio-api
fly secrets set JWT_SECRET="tu-frase-secreta-larga" --app el-patio-api
fly secrets set TELEGRAM_BOT_TOKEN="..." --app el-patio-api
fly secrets set CORS_ORIGIN="https://tu-webapp.vercel.app" --app el-patio-api
```

(Ajusta `CORS_ORIGIN` si la webapp está en otra URL.)

### 1.3 Desplegar api-gateway

```bash
fly deploy --config fly.api.toml
```

Comprobar:

```bash
fly status --app el-patio-api
fly logs --app el-patio-api
curl https://el-patio-api.fly.dev/health
```

Anota la URL del API (ej. `https://el-patio-api.fly.dev`); la usarás en el game-server y en la webapp.

---

## Paso 2: Game-server en Fly.io

### 2.1 Primera vez: crear la app (sin desplegar)

Desde la **raíz del monorepo**:

```bash
fly launch --config fly.game.toml --no-deploy
```

- "Create new app?" → **Yes**.
- Región → idealmente la misma que el api-gateway (ej. `gru`).

### 2.2 Secrets del game-server

El game-server debe hablar con el api-gateway en Fly (no con `http://api-gateway:3000`, que solo vale en Docker local):

```bash
fly secrets set MONGO_URI="<TU_URI_ATLAS>" --app el-patio-game
fly secrets set JWT_SECRET="tu-frase-secreta-larga" --app el-patio-game
fly secrets set API_GATEWAY_URL="https://el-patio-api.fly.dev" --app el-patio-game
```

Si la webapp va a conectar al game-server (WebSocket/HTTP), añade CORS:

```bash
fly secrets set CORS_ORIGIN="https://tu-webapp.vercel.app" --app el-patio-game
```

(Sustituye por la URL real de tu webapp; varios orígenes separados por comas si hace falta.)

### 2.3 Desplegar game-server

```bash
fly deploy --config fly.game.toml
```

Comprobar:

```bash
fly status --app el-patio-game
fly logs --app el-patio-game
curl https://el-patio-game.fly.dev/health
```

Deberías recibir algo como `{"status":"ok","service":"game-server"}`.

---

## Paso 3: Conectar la webapp

En el proyecto de la webapp (p. ej. Vercel), configura:

| Variable        | Valor (ejemplo)                          |
|-----------------|-------------------------------------------|
| `VITE_API_URL`  | `https://el-patio-api.fly.dev`           |
| URL del game    | `https://el-patio-game.fly.dev` (donde la webapp espere el host del game/WebSocket) |

Haz un redeploy de la webapp para que tome las nuevas URLs.

---

## Resumen de comandos (desde la raíz del repo)

```bash
# --- Local (Docker) ---
docker compose up --build api-gateway game-server

# --- API Gateway ---
fly launch --config fly.api.toml --no-deploy   # solo primera vez
fly secrets set MONGO_URI="..." JWT_SECRET="..." ... --app el-patio-api
fly deploy --config fly.api.toml

# --- Game-server ---
fly launch --config fly.game.toml --no-deploy  # solo primera vez
fly secrets set MONGO_URI="..." JWT_SECRET="..." API_GATEWAY_URL="https://el-patio-api.fly.dev" ... --app el-patio-game
fly deploy --config fly.game.toml

# --- Ver logs ---
fly logs --app el-patio-api
fly logs --app el-patio-game
```

---

## Notas

- **Mismo Docker que local:** tanto `fly.api.toml` como `fly.game.toml` están en la raíz y usan `apps/api-gateway/Dockerfile` y `apps/game-server/Dockerfile` con contexto de la raíz, igual que `docker-compose`.
- **Región:** usar la misma región para api y game reduce latencia entre ellos.
- **Coste:** revisa [fly.io/docs/about/pricing](https://fly.io/docs/about/pricing); el plan gratuito suele bastar para pruebas.
- Más detalle del api-gateway en [deploy-api-gateway-flyio.md](./deploy-api-gateway-flyio.md).
