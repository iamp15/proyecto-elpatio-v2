# Pruebas del Game Server — Guía paso a paso

Cubre: crear jugadores mock, gestionar saldo, cambiar de usuario en el navegador, probar la cola y el matchmaking completo.

---

## 0. Requisitos previos

Antes de empezar, asegúrate de tener los servidores corriendo:

```bash
docker compose up -d
npm run dev:webapp
```

---

## 1. Crear / actualizar usuarios de prueba

Ejecuta desde la **raíz del monorepo** (terminal, no navegador):

```bash
# Sintaxis
node packages/database/create-test-user.js [userId] [piedras] [username]

# Ejemplos
node packages/database/create-test-user.js 11111111 50 "Jugador1"
node packages/database/create-test-user.js 22222222 50 "Jugador2"

# Actualizar saldo de un usuario existente
node packages/database/create-test-user.js 11111111 3   # quedarse sin saldo para probar el rechazo
node packages/database/create-test-user.js 11111111 200 # recargar
```

Si el usuario ya existe, **solo se sobrescribe el saldo** — no afecta a otros usuarios.

---

## 2. Cambiar el usuario activo en la webapp

> **Nota importante sobre `localStorage`:** el almacenamiento local es compartido
> entre todas las pestañas del mismo origen. Si cambias el usuario en una pestaña,
> afectas a todas las demás. Para las pruebas de matchmaking usa el Script 3
> (que no toca `localStorage`). El Script B de esta sección sirve solo para
> cambiar lo que muestra la interfaz de la webapp.

### Opción A — Variable de entorno (persiste entre recargas)

Edita `apps/webapp/.env`:

```
VITE_MOCK_USER_ID=11111111
```

Luego pega esto en la **consola del navegador** para limpiar la sesión anterior y que tome el nuevo ID:

```javascript
// ── SCRIPT A: Limpiar sesión y recargar ──────────────────────────────────────
localStorage.removeItem('el_patio_token');
localStorage.removeItem('el_patio_user');
location.reload();
// ── FIN SCRIPT A ─────────────────────────────────────────────────────────────
```

> Reinicia Vite si acabas de crear el `.env` por primera vez.

### Opción B — Solo desde la consola (cambia lo que muestra la webapp)

⚠️ Esto escribe en `localStorage` y afecta a **todas las pestañas abiertas** del mismo origen.
Para pruebas de socket, usa directamente el Script 3 (que es autónomo).

```javascript
// ── SCRIPT B: Iniciar sesión como un userId específico en la webapp ───────────
localStorage.removeItem('el_patio_token');
localStorage.removeItem('el_patio_user');

const res = await fetch('http://localhost:3000/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ isMock: true, userId: 11111111 })  // <-- cambia este número
});
const data = await res.json();
localStorage.setItem('el_patio_token', data.token);
localStorage.setItem('el_patio_user', JSON.stringify(data.user));
console.log('Sesión iniciada como:', data.user);
location.reload();
// ── FIN SCRIPT B ─────────────────────────────────────────────────────────────
```

---

## 3. Script de prueba — Login + Conexión + Cola (todo en uno)

> **Por qué un solo script:** `localStorage` es compartido entre todas las pestañas del
> mismo origen. Si usas Script B en la pestaña 1 y luego en la pestaña 2, la pestaña 2
> sobreescribe el token de la 1 — y ambas terminarían conectándose como el mismo jugador.
>
> Este script hace el login y la conexión al socket **sin tocar `localStorage`**: el token
> vive solo en una variable local de esta pestaña y desaparece al cerrarla.

```javascript
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  SCRIPT 3 — Login + Conexión al game-server + Entrada en cola           ║
// ║  ► CAMBIA userId ANTES DE PEGAR. Cada pestaña debe usar un userId       ║
// ║    distinto. NO comparte nada con otras pestañas.                        ║
// ╚══════════════════════════════════════════════════════════════════════════╝

const TEST_USER_ID = 11111111;  // ← CAMBIA ESTE NÚMERO en cada pestaña
const MODE_ID      = '1v1_50';  // ← Modo de juego (ver tabla en sección 6)
const API_URL      = 'http://localhost:3000';
const SOCKET_URL   = 'http://localhost:3001';

// ── 1) Cargar socket.io-client desde CDN ────────────────────────────────────
await new Promise((resolve, reject) => {
  if (window.io) { resolve(); return; }  // ya cargado
  const s = document.createElement('script');
  s.src = 'https://cdn.socket.io/4.7.2/socket.io.min.js';
  s.onload = resolve;
  s.onerror = reject;
  document.head.appendChild(s);
});
console.log('[test] socket.io-client listo');

// ── 2) Login: obtener un JWT propio para este userId ─────────────────────────
//    El token queda en una const LOCAL — no se escribe en localStorage,
//    así que otras pestañas no se ven afectadas.
const loginRes = await fetch(`${API_URL}/auth/login`, {
  method:  'POST',
  headers: { 'Content-Type': 'application/json' },
  body:    JSON.stringify({ isMock: true, userId: TEST_USER_ID }),
});
if (!loginRes.ok) {
  console.error('[test] ❌ Login fallido:', await loginRes.text());
  throw new Error('Login fallido');
}
const { token, user } = await loginRes.json();
console.log(`[test] ✅ Login OK — userId=${user.telegramId} (${user.username})`);

// ── 3) Conectar al namespace /domino con el token de ESTE usuario ────────────
const socket = io(`${SOCKET_URL}/domino`, {
  auth:       { token },
  transports: ['websocket'],
});

// ── 4) Registrar oyentes de eventos ─────────────────────────────────────────

socket.on('connect', () => {
  console.log('[test] ✅ Conectado. Socket ID:', socket.id);
  socket.emit('join_queue', { modeId: MODE_ID });
  console.log(`[test] join_queue emitido — modeId="${MODE_ID}" (entry fee: 5 piedras)`);
});

socket.on('connect_error', (err) => {
  console.error('[test] ❌ Error de conexión:', err.message);
});

// Estado de la sala mientras se espera al rival
socket.on('queue_update', (data) => {
  console.log(`[test] 🕐 En cola — jugadores: ${data.players.length}, faltan: ${data.needed}`, data);
});

// Confirmación individual de cobro exitoso
socket.on('entry_fee_charged', (data) => {
  console.log(`[test] 💰 Entry fee cobrado. Nuevo saldo: ${data.piedras} piedras — "${data.message}"`);
});

// Saldo actualizado (tras cobro o tras recibir un premio)
socket.on('balance_updated', (data) => {
  console.log(`[test] 💵 balance_updated — ${data.piedras} piedras (${data.balance_subunits} subunits)`);
});

// Partida iniciada
socket.on('game_start', (data) => {
  console.log('[test] 🎮 ¡Partida iniciada!', data);
  window._testRoomId = data.roomId;
  console.log('[test] roomId guardado en window._testRoomId:', data.roomId);
  console.log('[test] → Para terminar, ejecuta el SCRIPT 3b en esta misma pestaña.');
});

// Saldo insuficiente al entrar a la cola o durante el cobro
socket.on('insufficient_balance', (data) => {
  console.warn('[test] 💸 Saldo insuficiente:', data);
  console.warn(`[test]   Requerido: ${data.required} piedras | Actual: ${data.current} piedras`);
});

// La sala fue desmontada porque otro jugador no tenía saldo
socket.on('queue_reset', (data) => {
  console.warn('[test] 🔄 Cola reiniciada (otro jugador falló el cobro):', data);
});

// Un jugador fue eliminado de la sala
socket.on('player_removed', (data) => {
  console.warn('[test] 👤 Jugador eliminado de la sala:', data);
});

// Resultado final de la partida (llega a todos los jugadores)
socket.on('game_over', (data) => {
  console.log('[test] 🏆 Partida terminada!');
  console.log(`[test]   Ganador:   userId=${data.winnerId}`);
  console.log(`[test]   Premio:    ${data.prize_piedras} piedras (${data.prize_subunits} subunits)`);
  console.log(`[test]   Comisión:  ${data.commission_pct}% (${data.commission_subunits} subunits)`);
  socket.disconnect();
});

socket.on('error', (data) => {
  console.error('[test] ⚠️  Error del servidor:', data);
});

socket.on('disconnect', (reason) => {
  console.log('[test] Desconectado. Razón:', reason);
});

// Exponer el socket y el userId local para usar desde la consola
window._testSocket = socket;
window._testUserId = TEST_USER_ID;
console.log(`[test] Socket guardado en window._testSocket (userId=${TEST_USER_ID})`);

// ── FIN SCRIPT 3 ──────────────────────────────────────────────────────────────
```


---

## 3b. Script — Terminar partida desde la UI (script autónomo)

> **Cuándo usarlo:** cuando estás en la página `/juegos/domino/:roomId` de la webapp y quieres
> declararte ganador sin jugar la partida completa.
>
> Lee el token y el userId directamente de `localStorage`, y el roomId de la URL.
> No interfiere con otras pestañas. Funciona en cualquier navegador donde hayas iniciado sesión.

```javascript
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  SCRIPT 3b — Terminar partida (declararse ganador desde la UI)          ║
// ║  Pega esto en la consola del navegador estando en /juegos/domino/:roomId║
// ╚══════════════════════════════════════════════════════════════════════════╝

// ── 1) Leer credenciales de la sesión activa ─────────────────────────────────
const token  = localStorage.getItem('el_patio_token');
const _user  = JSON.parse(localStorage.getItem('el_patio_user') || 'null');
const userId = _user?.id;

if (!token || !userId) {
  console.error('[finish] ❌ No hay sesión activa. Inicia sesión en la webapp primero.');
  throw new Error('Sin sesión');
}

// ── 2) Leer roomId de la URL (/juegos/domino/:roomId) ────────────────────────
const roomId = window.location.pathname.split('/').pop();
if (!roomId || roomId.length < 10) {
  console.error('[finish] ❌ No se detectó un roomId válido en la URL:', window.location.pathname);
  throw new Error('roomId inválido');
}

console.log(`[finish] userId=${userId} | roomId=${roomId}`);

// ── 3) Cargar socket.io-client si no está disponible ────────────────────────
await new Promise((resolve, reject) => {
  if (window.io) { resolve(); return; }
  const s = document.createElement('script');
  s.src = 'https://cdn.socket.io/4.7.2/socket.io.min.js';
  s.onload = resolve; s.onerror = reject;
  document.head.appendChild(s);
});

// ── 4) Conectar al namespace /domino ────────────────────────────────────────
const socket = io('http://localhost:3001/domino', {
  auth: { token }, transports: ['websocket'],
});

socket.on('connect', () => {
  console.log('[finish] ✅ Conectado. Reconectando a la sala...');
  socket.emit('rejoin_room', { roomId });
});

socket.on('connect_error', (err) => {
  console.error('[finish] ❌ Error de conexión:', err.message);
});

// ── 5) Una vez en sala, declarar ganador y cerrar ────────────────────────────
socket.on('game_rejoined', (data) => {
  console.log('[finish] ✅ En sala. Estado actual:', data.state.status);
  console.log(`[finish] 🏁 Declarando ganador: userId=${userId}`);
  socket.emit('game_over', { winnerId: userId });
});

socket.on('game_over', (result) => {
  console.log('[finish] 🏆 Partida terminada!');
  console.log(`[finish]   Ganador:  userId=${result.winnerId}`);
  console.log(`[finish]   Premio:   ${result.prize_piedras} piedras`);
  console.log('[finish]   Puntos finales:', result.finalScores);
  socket.disconnect();
});

socket.on('rejoin_error', (err) => {
  console.error('[finish] ❌ No se pudo reconectar a la sala:', err.message);
  console.warn('[finish]   La partida puede haber terminado ya o el roomId es incorrecto.');
  socket.disconnect();
});

socket.on('error', (err) => {
  console.error('[finish] ⚠️ Error del servidor:', err.message);
  socket.disconnect();
});

// ── FIN SCRIPT 3b ─────────────────────────────────────────────────────────────
```

> **El servidor valida** que `winnerId` sea un jugador de la sala. Si el userId de tu sesión
> no está en la partida, recibirás un evento `error`.
>
> **La UI reaccionará automáticamente**: al recibir el `game_over`, el `GameOverModal`
> aparecerá sobre el tablero en la pestaña donde está la webapp.

### Script 3b (versión legacy — para usar con Script 3)

Si prefieres usarlo junto con el Script 3 del matchmaking (que guarda `window._testSocket`):

```javascript
// Declara ganador al usuario de ESTA pestaña (guardado por el Script 3)
const myUserId = window._testUserId;
if (!myUserId) { console.error('[test] No se encontró _testUserId. ¿Ejecutaste el Script 3 en esta pestaña?'); throw new Error(); }

window._testSocket.emit('game_over', { winnerId: myUserId });
console.log('[test] game_over emitido. Ganador declarado: userId=' + myUserId);
```

**Resultado esperado tras ejecutar el Script 3b:**

- Ambas pestañas reciben `game_over` con el premio y la comisión.
- Solo la pestaña del ganador recibe además `balance_updated` con el saldo actualizado.

**Cálculo del premio para `1v1_50`:**

```
Entry fee:  5 piedras × 2 jugadores = 10 piedras en el bote
Premio:     10 × 80% = 8 piedras  → al ganador
Comisión:   10 × 20% = 2 piedras  → casa
```

---

## 4. Probar el matchmaking completo (2 jugadores)

### Setup (terminal)

```bash
# Crear dos jugadores con saldo suficiente (entry fee 1v1_50 = 5 piedras)
node packages/database/create-test-user.js 11111111 50 "Jugador1"
node packages/database/create-test-user.js 22222222 50 "Jugador2"
```

### Ejecución

> No es necesario hacer nada antes en la webapp. El Script 3 hace el login solo.

1. **Pestaña A** — Cambia `TEST_USER_ID = 11111111` en el Script 3 y pégalo en la consola → verás `🕐 En cola, faltan: 1`.
2. **Pestaña B** — Cambia `TEST_USER_ID = 22222222` en el Script 3 y pégalo en la consola → ambas pestañas muestran `game_start`.
3. **Cualquier pestaña** — Pega el **Script 3b** para declarar ganador (usará el `_testUserId` de esa pestaña).

### Resultado esperado en consola (ambas pestañas)

```
[test] ✅ Conectado. Socket ID: xxxx
[test] join_queue emitido con modeId="1v1_50" (entry fee: 5 piedras)
[test] 🕐 En cola — jugadores: 1, faltan: 1
[test] 💰 Entry fee cobrado. Nuevo saldo: 45 piedras — "¡Entrada cobrada con éxito. Buena suerte!"
[test] 💵 balance_updated — 45 piedras (4500 subunits)
[test] 🎮 ¡Partida iniciada! { roomId: '...', config: {...}, players: [...] }
--- tras ejecutar Script 3b ---
[test] 🏆 Partida terminada!
[test]   Ganador:   userId=11111111
[test]   Premio:    8 piedras (800 subunits)
[test]   Comisión:  20% (200 subunits)
[test] 💵 balance_updated — 53 piedras (5300 subunits)   ← solo en la pestaña del ganador
```

---

## 5. Casos de prueba adicionales

### Saldo insuficiente al hacer join_queue

```bash
# Terminal — poner saldo por debajo del entry fee
node packages/database/create-test-user.js 11111111 3  # 3 piedras, fee es 5
```

Luego ejecuta el **Script 3** en la pestaña del Jugador1. Verás `💸 insufficient_balance` — el jugador nunca llega a entrar en la sala.

---

### Saldo insuficiente durante el cobro (caso extremo)

```bash
# Terminal
node packages/database/create-test-user.js 11111111 5   # saldo justo
node packages/database/create-test-user.js 22222222 50  # saldo suficiente
```

1. Conecta Jugador1 y Jugador2 a la cola con el **Script 3**.
2. Antes de que entre el segundo, ejecuta en una tercera terminal:

```bash
# Terminal — gastar las piedras de Jugador1 por otro medio
node packages/database/test-concurrencia.js
```

Resultado esperado: Jugador1 recibe `insufficient_balance`, Jugador2 recibe `queue_reset`.

---

### Probar modo 2v2

En el **Script 3**, cambia la línea del `join_queue`:

```javascript
socket.emit('join_queue', { modeId: '2v2_50' });  // necesitarás 4 pestañas
```

---

## 6. Referencia rápida — Modos de juego y premios

| modeId    | Jugadores | Objetivo | Entry Fee  | Premio (80%) | Comisión (20%) |
|-----------|-----------|----------|------------|--------------|----------------|
| `1v1_50`  | 2         | 50 pts   | 5 piedras  | 8 piedras    | 2 piedras      |
| `1v1_100` | 2         | 100 pts  | 10 piedras | 16 piedras   | 4 piedras      |
| `2v2_50`  | 4         | 50 pts   | 5 piedras  | 16 piedras   | 4 piedras      |

---

## 7. Referencia rápida — Eventos del socket

| Evento                | Dirección        | Descripción                                                          |
|-----------------------|------------------|----------------------------------------------------------------------|
| `join_queue`          | cliente → server | Entrar a la cola con un `modeId`                                     |
| `queue_update`        | server → cliente | Estado actual de la sala (jugadores, faltan N)                       |
| `entry_fee_charged`   | server → cliente | Confirmación individual de cobro + nuevo saldo                       |
| `balance_updated`     | server → cliente | Saldo actualizado (tras cobro o tras premio)                         |
| `game_start`          | server → cliente | Partida iniciada con estado inicial personalizado por jugador        |
| `rejoin_room`         | cliente → server | Reconectar a una partida activa por roomId (tras recarga/desconexión)|
| `game_rejoined`       | server → cliente | Estado actual de la partida tras reconexión exitosa                  |
| `rejoin_error`        | server → cliente | No se pudo reconectar (sala no existe, no eres jugador, etc.)        |
| `game_action`         | cliente → server | Acción de juego: `{ actionType, tile?, side? }`                      |
| `game_state`          | server → cliente | Estado actualizado tras cada acción (personalizado por jugador)      |
| `invalid_move`        | server → cliente | La acción enviada no es válida, con razón explicada                  |
| `game_over`           | cliente → server | Forzar fin de partida declarando ganador (`{ winnerId }`)            |
| `game_over`           | server → cliente | Resultado final: `winnerId`, `prize_piedras`, `finalScores`          |
| `insufficient_balance`| server → cliente | Saldo insuficiente (pre-check o cobro fallido)                       |
| `queue_reset`         | server → cliente | La sala fue desmontada, volver a buscar                              |
| `player_removed`      | server → cliente | Un jugador fue eliminado de la sala                                  |
| `error`               | server → cliente | Error genérico del servidor                                          |
