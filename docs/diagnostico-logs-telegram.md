# Diagnóstico: logs al probar la webapp desde Telegram

Cuando pruebas la webapp en Vercel desde Telegram (Mini App), los logs que añadiste pueden no verse por varias razones. Esta guía aclara **dónde** aparece cada tipo de log y **qué comprobar** si no ves nada.

---

## 1. Logs de la webapp (`[Login] ...`, `[ElPatio] main.tsx cargado`)

**Dónde se ejecutan:** En el **navegador** (o en el WebView de Telegram). Son `console.log` del código que corre en el dispositivo del usuario.

**Dónde NO aparecen:** En Vercel, en el panel de Vercel ni en ningún servidor. Vercel solo sirve archivos estáticos (HTML/JS/CSS); el JavaScript se ejecuta en el cliente.

**Cómo verlos:**

- **Desde PC:** Abre la misma URL de la webapp en Chrome o Firefox (ej. `https://proyecto-elpatio-v2-webapp.vercel.app`) y abre la consola (F12 → pestaña Console). Reproduce el flujo de login; ahí deberían salir los logs.
- **Desde Telegram en el móvil:** Hace falta depuración remota (Chrome remote debugging para Android, Safari/Web Inspector para iOS) o usar **Telegram Desktop** y, si está disponible, las herramientas de desarrollador del cliente.
- **Comprobar que el bundle nuevo está desplegado:** En la consola del navegador (abriendo la URL en PC) deberías ver en la primera línea algo como `[ElPatio] main.tsx cargado (bundle con logs de login)`. Si no sale, el navegador está cargando una versión en caché o un deploy antiguo (ver sección 3).

---

## 2. Logs del api-gateway (`[auth] POST /login`, `[health] GET /health/debug`)

**Dónde se ejecutan:** En el proceso Node del api-gateway (en tu máquina, dentro del contenedor Docker si usas Docker).

**Dónde verlos:**

- **Si usas Docker:** En la terminal donde corre el contenedor o con:
  ```bash
  docker compose logs -f api-gateway
  ```
  (o `docker-compose logs -f api-gateway` según tu versión.)
- **Si corres el gateway con npm:** En la misma terminal donde ejecutaste `npm run dev:api` (o `node src/index.js`).

Si **no** ves ningún `[auth] POST /login` cuando haces login desde la webapp, lo más probable es que **la petición no esté llegando al api-gateway**. Sigue la sección 3.

---

## 3. Comprobar que las peticiones llegan al api-gateway (VITE_API_URL + túnel)

En Vite, `VITE_API_URL` se **embebe en el bundle en el momento del build**. Si la webapp en Vercel fue construida con una URL distinta a la de tu localtunnel, las peticiones irán a otro sitio y el api-gateway no recibirá nada.

### 3.1 Endpoint de diagnóstico

Se añadió un endpoint que escribe un log cada vez que se llama:

- **URL:** `GET /health/debug` (desde la base del api-gateway).
- **Ejemplo con túnel:** Si tu localtunnel es `https://xyz.loca.lt`, abre en el navegador:
  ```
  https://xyz.loca.lt/health/debug
  ```
- **Qué hacer:** Mientras tienes `docker compose logs -f api-gateway` (o la terminal del gateway) abierto, carga esa URL. Deberías ver algo como:
  ```
  [health] GET /health/debug recibido 2025-02-24T... | Origin: ...
  ```
- **Si no aparece ese log:** El túnel no está llegando al gateway, o la URL que usas no es la del proceso que estás mirando (otro puerto, otro contenedor, etc.).

### 3.2 Checklist

1. **Vercel – Variable de entorno**
   - En el proyecto de Vercel: **Settings → Environment Variables**.
   - Debe existir `VITE_API_URL` con la URL **HTTPS** de tu localtunnel (ej. `https://xyz.loca.lt`), sin barra final.
   - Debe estar aplicada al entorno que usas (Production y/o Preview).

2. **Vercel – Redeploy**
   - Después de cambiar `VITE_API_URL` (o cualquier `VITE_*`), hay que **volver a desplegar** la webapp para que el nuevo build incluya la URL. Sin redeploy, el bundle sigue con la URL antigua.

3. **CORS en el api-gateway**
   - En `apps/api-gateway/.env` (o las variables que use el contenedor) debe estar `CORS_ORIGIN` con el origen de la webapp y, si aplica, el del túnel, por ejemplo:
     ```
     CORS_ORIGIN=https://proyecto-elpatio-v2-webapp.vercel.app,https://tu-subdominio.loca.lt
     ```
   - Reinicia el api-gateway después de cambiar `.env`.

4. **Contenedor actualizado**
   - Si cambiaste código del api-gateway (p. ej. los logs en `auth.js` o `health.js`), hay que **reconstruir la imagen y levantar de nuevo el contenedor**:
     ```bash
     docker compose build api-gateway
     docker compose up -d api-gateway
     ```
   - Luego revisa los logs con `docker compose logs -f api-gateway` y verifica que es ese contenedor el que está recibiendo el tráfico del túnel (puerto 3000).

5. **Localtunnel**
   - El túnel debe estar apuntando al mismo puerto donde escucha el api-gateway (ej. 3000). Si usas `lt --port 3000`, la URL que te da `lt` es la que debe estar en `VITE_API_URL` en Vercel (tras redeploy).

---

## 4. Resumen rápido

| Dónde quieres ver logs | Dónde mirar |
|------------------------|-------------|
| Webapp (login, detección Telegram, etc.) | Consola del navegador (F12) al abrir la URL de la webapp en el PC. No en Vercel. |
| Api-gateway (auth, health) | `docker compose logs -f api-gateway` o la terminal donde corre Node. |
| ¿Llegan peticiones al gateway? | Llamar a `GET /health/debug` con la URL del túnel y comprobar que aparece `[health] GET /health/debug recibido` en los logs del gateway. |

Si tras esto sigues sin ver logs del gateway al hacer login, la petición de login no está llegando (revisa `VITE_API_URL` en Vercel, redeploy, CORS y que el túnel apunte al puerto correcto).
