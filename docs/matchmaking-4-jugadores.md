# Matchmaking para 4 jugadores (ORO, DIAMANTE)

**Estado:** Trabajo futuro  
**Fase actual:** BRONCE y PLATA (2 jugadores) con Waterfall Search implementado.

---

## Implementación actual (2v2)

### Arquitectura base: Waterfall Search

El matchmaking usa **Búsqueda en Cascada** para optimizar la búsqueda por buckets (ligas) manteniendo el cruce de ligas (`allowLowerLeague`).

#### Definición de fronteras

- **ConfigManager**: Cada categoría tiene `lowerCategory` (liga inmediatamente inferior).
- BRONCE: `lowerCategory: null`
- PLATA: `lowerCategory: 'BRONCE'`
- ORO: `lowerCategory: 'PLATA'`
- DIAMANTE: `lowerCategory: 'ORO'`

#### Constantes

| Constante | Valor | Descripción |
|-----------|-------|-------------|
| `BASE_PR_RANGE` | 50 | Rango base de PR para emparejar |
| `PR_EXPANSION_PER_SECOND` | 10 | Expansión de rango por segundo en cola |
| `TICK_INTERVAL_MS` | 1500 | Intervalo del tick de matchmaking |
| `MAX_MATCHES_PER_TICK` | 5 | Máximo emparejamientos por ciclo |
| `LARGE_QUEUE_THRESHOLD` | 200 | Umbral para diferir con `setImmediate` |

#### Flujo del tick

1. **Expansión del radar**: `searchRadius = BASE_PR_RANGE + (PR_EXPANSION_PER_SECOND * secondsInQueue)`
2. **minAcceptablePR**: `player.pr - searchRadius`
3. **Cross-Bucket Peeking**: Para cada jugador de la categoría procesada:
   - Candidatos = jugadores de su liga actual
   - Si `allowLowerLeague` y `minAcceptablePR` está en el rango de la liga inferior → añadir candidatos de esa liga
4. **Selección del mejor match**: Filtrar por aceptación mutua (`_canMatch`), ordenar por menor Delta PR y mayor tiempo en cola
5. **Regla económica**: Si el match es cross-league, la sala usa la config de la liga inferior (`entryFee`, `targetPoints`)

#### Orden de procesamiento

- BRONCE primero (solo BRONCE+BRONCE)
- PLATA después (PLATA+PLATA y PLATA+BRONCE cuando aplica)

---

## Contexto para 4 jugadores

Las categorías ORO y DIAMANTE requieren `maxPlayers: 4`. El algoritmo debe extenderse para formar grupos de 4 jugadores reutilizando la arquitectura Waterfall Search.

---

## Alcance de la extensión

1. **MatchmakingQueue**: Permitir categorías con `maxPlayers === 4`.
2. **QueueStore**: Incluir ORO y DIAMANTE en el conteo y buckets.
3. **Algoritmo**: Extender Waterfall Search para grupos de 4.
4. **Scoring**: Definir cómo puntuar la calidad de un grupo de 4.

---

## Algoritmo propuesto para 4 jugadores

### Waterfall Search adaptado

- **Candidatos por jugador**: Igual que 2v2: liga actual + liga inferior si `allowLowerLeague` y `minAcceptablePR` en rango.
- **Grupos de 4**: Generar combinaciones de 4 jugadores donde cada uno tenga a los otros en su pool de candidatos (o validar con `_canMatch` extendido para grupos).

### Criterios de score para grupos de 4

- **Opción A — MaxDelta:**  
  `score = -maxDelta`, donde `maxDelta = max(|pi.pr - pj.pr|)` para todos los pares del grupo.  
  Minimiza la mayor diferencia de PR entre cualquier par.

- **Opción B — Varianza:**  
  `score = -variance(pr1, pr2, pr3, pr4)`.  
  Minimiza la dispersión de PR dentro del grupo.

- **Opción C — Tiempo en cola:**  
  Priorizar grupos donde el jugador con más tiempo en cola sea mayor.  
  Orden secundario: `min(joinTime)` ascendente.

### Reglas de expansión

- Misma lógica: `searchRadius = BASE_PR_RANGE + (PR_EXPANSION_PER_SECOND * secondsInQueue)`.
- Para grupos de 4, considerar el jugador con más tiempo en cola como referencia para el rango permitido (o aplicar el mínimo de los 4 `searchRadius` para ser conservador).

### Cross-league para 4 jugadores

- **Regla económica estricta**: Si el grupo incluye jugadores de liga inferior, la sala usa la configuración de la categoría **inferior** (entryFee, targetPoints).
- Combinaciones válidas: ej. 2 ORO + 2 PLATA si los de ORO tienen `allowLowerLeague` y sus `minAcceptablePR` entran en rango PLATA.
- Definir qué mezclas son aceptables (ej. máximo 1 liga de diferencia).

---

## Tareas de implementación

1. **QueueStore**: Añadir `getTotal4v4Count()` y considerar ORO/DIAMANTE en el flujo.
2. **MatchmakingQueue**: 
   - Permitir `maxPlayers === 4` en `addPlayer`.
   - Crear `_findBestGroup(maxPlayers)` que extienda la lógica de `_findBestPair`.
   - Extender `_canMatch` → `_canMatchGroup(players, now)` para validar grupos de 4.
   - Añadir `CATEGORIES_4V4 = ['ORO', 'DIAMANTE']` y procesarlas en el tick.
3. **Waterfall para 4**: Cada jugador ORO/DIAMANTE obtiene candidatos con `_getCandidatesForPlayer` (ORO puede incluir PLATA; DIAMANTE puede incluir ORO).
4. **RoomManager**: Asegurar que `createRoomWithConfig` soporte salas de 4 jugadores.
5. **Frontend**: Habilitar las cards de ORO y DIAMANTE cuando el backend lo soporte.

---

## Referencias

- [apps/game-server/src/matchmaking/MatchmakingQueue.js](../apps/game-server/src/matchmaking/MatchmakingQueue.js) — Implementación actual con Waterfall Search.
- [apps/game-server/src/config/ConfigManager.js](../apps/game-server/src/config/ConfigManager.js) — `getLowerCategory`, `getRankConfig`.
- [apps/game-server/src/matchmaking/QueueStore.js](../apps/game-server/src/matchmaking/QueueStore.js) — Buckets por categoría.
- [apps/game-server/src/matchmaking/RoomManager.js](../apps/game-server/src/matchmaking/RoomManager.js) — Creación de salas.
