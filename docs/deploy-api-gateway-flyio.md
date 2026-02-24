# Desplegar api-gateway en Fly.io

Pasos para desplegar el api-gateway en Fly.io y usarlo desde la webapp en Vercel.

---

## Requisitos previos

1. **Cuenta en Fly.io**  
   Regístrate en [fly.io](https://fly.io) y instala la CLI:

   ```bash
   # Windows (PowerShell)
   iwr https://fly.io/install.ps1 -useb | iex

   # O con npm
   npm install -g flyctl
   ```

   Luego inicia sesión:

   ```bash
   fly auth login
   ```

2. **MongoDB accesible desde internet**  
   El api-gateway necesita `MONGO_URI`. Opciones:

   - **MongoDB Atlas** (recomendado): crea un cluster gratuito en [cloud.mongodb.com](https://cloud.mongodb.com), obtén la URI de conexión y en “Network Access” permite acceso desde cualquier IP (`0.0.0.0/0`) o desde las IP de Fly.
   - MongoDB ya desplegado en otro proveedor con URI accesible.

3. **Variables que usarás**  
   Ten a mano:
   - `MONGO_URI`: la URI de conexión que te da MongoDB Atlas (Dashboard → Connect → “Connect your application”).
   - `JWT_SECRET` (una frase larga y aleatoria)
   - `TELEGRAM_BOT_TOKEN` (de @BotFather)
   - URL de la webapp en Vercel para CORS (ej. `https://proyecto-elpatio-v2-webapp.vercel.app`)

---

## Paso 1: Crear la app en Fly (solo la primera vez)

Desde la **raíz del monorepo**:

```bash
fly launch --config fly.api.toml --no-deploy
```

- Si pregunta “Create new app?” → **Yes**.
- Si pregunta por región → elige la más cercana a tus usuarios (ej. `mad` para Madrid).
- `--no-deploy` evita desplegar hasta que tengas los secrets configurados.

Si la app `el-patio-api` ya existe (por un `fly launch` anterior), no hace falta volver a lanzar; pasa al paso 2.

---

## Paso 2: Configurar secrets (variables sensibles)

En Fly, los secretos no van en `fly.toml`; se configuran con `fly secrets set`:

```bash
# Sustituye <TU_URI_ATLAS> por la URI que te da MongoDB Atlas (nunca la subas al repo)
fly secrets set MONGO_URI="<TU_URI_ATLAS>" --app el-patio-api
fly secrets set JWT_SECRET="tu-frase-secreta-larga-y-aleatoria" --app el-patio-api
fly secrets set TELEGRAM_BOT_TOKEN="123456:ABC-DEF...." --app el-patio-api
fly secrets set CORS_ORIGIN="https://proyecto-elpatio-v2-webapp.vercel.app" --app el-patio-api
```

Sustituye cada valor por el tuyo. Para comprobar (solo nombres, no valores):

```bash
fly secrets list --app el-patio-api
```

---

## Paso 3: Desplegar

Desde la **raíz del monorepo**:

```bash
fly deploy --config fly.api.toml
```

El build usa el Dockerfile de `apps/api-gateway` con el contexto en la raíz (monorepo). Al terminar, Fly te dará la URL pública, por ejemplo:

- `https://el-patio-api.fly.dev`

Comprueba el estado y los logs:

```bash
fly status --app el-patio-api
fly logs --app el-patio-api
```

Prueba el health check en el navegador o con curl:

```bash
curl https://el-patio-api.fly.dev/health
```

Deberías recibir algo como `{"status":"ok","timestamp":"..."}`.

---

## Paso 4: Conectar la webapp en Vercel al api-gateway en Fly

1. En el proyecto de la **webapp en Vercel**: **Settings** → **Environment Variables**.
2. Crea o edita:
   - **Name:** `VITE_API_URL`
   - **Value:** la URL de tu api en Fly **sin barra final** (ej. `https://el-patio-api.fly.dev`)
   - Entorno: **Production** (y Preview si quieres).
3. Guarda y haz un **Redeploy** de la webapp para que el nuevo build use esa URL.

A partir de ahí, la webapp en Vercel llamará al api-gateway en Fly.io.

---

## Resumen de comandos (desde la raíz del repo)

```bash
# Primera vez: crear app (sin desplegar)
fly launch --config fly.api.toml --no-deploy

# Configurar secretos (sustituir valores)
fly secrets set MONGO_URI="..." JWT_SECRET="..." TELEGRAM_BOT_TOKEN="..." CORS_ORIGIN="https://tu-webapp.vercel.app" --app el-patio-api

# Desplegar
fly deploy --config fly.api.toml

# Ver logs
fly logs --app el-patio-api
```

---

## Notas

- **MongoDB:** Si usas Atlas, en “Network Access” permite `0.0.0.0/0` o revisa la [documentación de Fly](https://fly.io/docs/reference/private-networking/) si quieres restringir por IP.
- **CORS:** `CORS_ORIGIN` debe incluir exactamente la URL de la webapp (origen del navegador). Si tienes varios orígenes, sepáralos por comas: `https://webapp.vercel.app,https://otro-dominio.com`.
- **Coste:** En el plan gratuito de Fly suele haber suficiente margen para una app pequeña; revisa [fly.io/docs/about/pricing](https://fly.io/docs/about/pricing).
- **Variables opcionales:** Si en el api-gateway usas más env (por ejemplo `STORES_FACTOR`, `PIEDRA_USD_RATE`), puedes añadirlas con `fly secrets set` o en la sección `[env]` de `fly.api.toml` (solo para valores no sensibles).
