# Túnel ngrok para probar la webapp en Vercel con el api-gateway local

Permite que la webapp desplegada en Vercel (`https://proyecto-elpatio-v2-webapp.vercel.app`) llame al api-gateway que corre en tu máquina.

## Requisitos

- [ngrok](https://ngrok.com/download) instalado (o `npm i -g ngrok`).
- MongoDB accesible (local o Atlas).
- Variables de entorno del api-gateway configuradas (`.env` en `apps/api-gateway`).

## Pasos

### 1. Configurar CORS en el api-gateway

En `apps/api-gateway/.env` añade o ajusta `CORS_ORIGIN` con la URL de la webapp en Vercel y la URL que te dará ngrok (la actualizarás tras el paso 3):

```env
CORS_ORIGIN=https://proyecto-elpatio-v2-webapp.vercel.app,https://TU-URL.ngrok-free.app
```

(Si usas ngrok gratuito, la subdominio puede cambiar en cada sesión; actualiza esta variable si cambia.)

### 2. Arrancar el api-gateway

Desde la raíz del monorepo:

```bash
npm run dev:api
```

O desde `apps/api-gateway`:

```bash
node src/index.js
```

Comprueba que responde en `http://localhost:3000` (por ejemplo `GET http://localhost:3000/health`).

### 3. Exponer el puerto con ngrok

**Importante:** ejecuta ngrok desde una terminal que **tú abras** (PowerShell o CMD), no haciendo doble clic en ngrok. Si abres ngrok con doble clic, la ventana puede cerrarse al instante y no verás la URL.

En otra terminal, desde la raíz del proyecto:

```bash
npm run tunnel
```

O directamente (si ngrok está en el PATH):

```bash
ngrok http 3000
```

Copia la URL HTTPS que muestra ngrok (ej. `https://abc123.ngrok-free.app`).

- Si en el paso 1 no habías puesto aún la URL de ngrok, actualiza `CORS_ORIGIN` en `.env` y reinicia el api-gateway.
- En la plan gratuita la URL cambia cada vez que reinicias ngrok.

### 4. Configurar la webapp en Vercel

En el proyecto de Vercel (webapp):

1. **Settings** → **Environment Variables**.
2. Añade o edita:
   - **Name:** `VITE_API_URL`
   - **Value:** la URL HTTPS de ngrok (ej. `https://abc123.ngrok-free.app`)
   - Aplica a **Production** (y Preview si quieres).
3. Guarda y **redeploy** la webapp para que el build use la nueva variable.

### 5. Probar el login por Telegram

1. Abre la webapp desde Telegram (como Mini App) o desde el navegador: `https://proyecto-elpatio-v2-webapp.vercel.app/`.
2. Inicia sesión; la webapp enviará `initData` al api-gateway a través de la URL de ngrok.
3. El api-gateway debe tener `TELEGRAM_BOT_TOKEN` en su `.env` para validar `initData`.

## Notas

- **Pantalla "Visit Site" de ngrok:** En plan gratuito, ngrok puede mostrar una página de advertencia antes de llegar al API. Si las peticiones desde la webapp fallan o devuelven HTML en lugar de JSON, añade el header `ngrok-skip-browser-warning: true` en las peticiones al API (o en el cliente en `apps/webapp/src/api/client.js`). En muchos casos abrir primero la URL de ngrok en el navegador y pulsar "Visit Site" basta para esa sesión.
- Con ngrok gratuito, la URL HTTPS cambia al reiniciar ngrok; tendrás que actualizar `VITE_API_URL` en Vercel y, si cambia el dominio, `CORS_ORIGIN` en el api-gateway.
- Mantén el api-gateway y ngrok en ejecución mientras pruebes; si cierras tu PC, la webapp en Vercel dejará de poder llamar al API.
- Para producción estable, despliega el api-gateway (Railway, Render, Fly.io, etc.) y usa esa URL fija en `VITE_API_URL`.

## La ventana de ngrok se cierra al instante

Si al ejecutar ngrok se abre una ventana CMD y se cierra de inmediato:

1. **No ejecutes ngrok con doble clic** en el .exe ni en un acceso directo. Así, al terminar o fallar, la ventana se cierra y no ves el mensaje.
2. **Abre tú la terminal:** PowerShell o CMD (Win+R → `powershell` o `cmd` → Enter).
3. Ve a la carpeta del proyecto: `cd D:\Proyectos\proyecto-el-patio-v2` (o tu ruta).
4. Ejecuta: `npm run tunnel` o `ngrok http 3000`. La terminal se quedará abierta y verás la URL HTTPS y cualquier error.
5. Si sale *"ngrok no se reconoce"*, ngrok no está en el PATH: instálalo bien desde [ngrok.com/download](https://ngrok.com/download) o con `npm install -g ngrok` y vuelve a abrir la terminal.
