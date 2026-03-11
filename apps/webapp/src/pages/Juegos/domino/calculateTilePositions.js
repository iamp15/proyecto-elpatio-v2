const TILE_W = 40;
const TILE_H = 80;

/**
 * Radios y rotación según si la ficha es doble (horizontal) o normal (vertical).
 * Normal: 40×80 → radiusY=40, radiusX=20
 * Doble:  80×40 → radiusY=20, radiusX=40
 */
const getTileMetrics = (isDouble) => ({
  radiusY: isDouble ? TILE_W / 2 : TILE_H / 2,
  radiusX: isDouble ? TILE_H / 2 : TILE_W / 2,
  rotation: isDouble ? 90 : 0,
});

const DEFAULT_EXTENTS = { minX: 0, maxX: 0, minY: 0, maxY: 0 };

/**
 * Calcula las posiciones absolutas de las fichas en el tablero (La Culebrita).
 * Centro del tablero: X: 0, Y: 0.
 * Usa distancia centro a centro para evitar huecos entre fichas.
 *
 * @param {Array<{ tile: { a: number, b: number }, side: string, playedBy: number }>} playedTiles
 * @param {{ a: number, b: number } | null} [nextTile] - Ficha que se va a colocar (para sombras). Aplica postergación de curvas con dobles.
 * @returns {{ positions: Array<{ ...entry, x: number, y: number, rotation: number }>, extents: { minX: number, maxX: number, minY: number, maxY: number }, endPositions: object | null }}
 */
export function calculateTilePositions(playedTiles, nextTile = null) {
  const MAX_VERTICAL_TILES = 3;
  const MAX_HORIZONTAL_TILES = 2;

  if (!playedTiles || playedTiles.length === 0) {
    return { positions: [], extents: DEFAULT_EXTENTS, endPositions: null };
  }

  const firstIndex = playedTiles.findIndex((e) => e.side === 'first');
  if (firstIndex === -1) {
    const positions = playedTiles.map((e, i) => ({ ...e, x: 0, y: 0, rotation: 0 }));
    return { positions, extents: DEFAULT_EXTENTS, endPositions: null };
  }

  const result = playedTiles.map((entry, i) => ({ ...entry, x: 0, y: 0, rotation: 0, boardFlip: false }));

  let minX = 0;
  let maxX = 0;
  let minY = 0;
  let maxY = 0;

  // Visual extents: track tile edges (center ± radiusX/Y)
  const updateExtents = (x, y, radiusX, radiusY) => {
    minX = Math.min(minX, x - radiusX);
    maxX = Math.max(maxX, x + radiusX);
    minY = Math.min(minY, y - radiusY);
    maxY = Math.max(maxY, y + radiusY);
  };

  const isDouble = (tile) => tile.a === tile.b;

  // Ficha inicial en el centro
  const firstDouble = isDouble(result[firstIndex].tile);
  result[firstIndex].x = 0;
  result[firstIndex].y = 0;
  result[firstIndex].rotation = getTileMetrics(firstDouble).rotation;
  updateExtents(result[firstIndex].x, result[firstIndex].y, getTileMetrics(firstDouble).radiusX, getTileMetrics(firstDouble).radiusY);

  // Rastreadores de posición para acumulación estricta
  let lastPosA = { x: result[firstIndex].x, y: result[firstIndex].y };
  let lastPosB = { x: result[firstIndex].x, y: result[firstIndex].y };
  let lastDoubleA = firstDouble;
  let lastDoubleB = firstDouble;

  // Índices de giro dinámicos (un doble nunca hace curva)
  let turn1A = MAX_VERTICAL_TILES;
  let turn2A = MAX_VERTICAL_TILES + MAX_HORIZONTAL_TILES;
  let turn1B = MAX_VERTICAL_TILES;
  let turn2B = MAX_VERTICAL_TILES + MAX_HORIZONTAL_TILES;

  // Lado A (Sube -> Derecha -> Baja): 5 estados
  for (let k = 1; k <= firstIndex; k++) {
    const i = firstIndex - k;
    const tile = result[i].tile;
    const currDouble = isDouble(tile);
    const prevMetrics = getTileMetrics(lastDoubleA);
    const currMetrics = getTileMetrics(currDouble);

    // Postergación: no girar con doble ni con la ficha siguiente al doble
    const prevTileA = result[firstIndex - k + 1]?.tile;
    const prevIsDoubleA = prevTileA ? isDouble(prevTileA) : false;
    if (k === turn1A && (currDouble || prevIsDoubleA)) {
      turn1A++;
      turn2A++;
    }
    if (k === turn2A && (currDouble || prevIsDoubleA)) {
      turn2A++;
    }

    if (k < turn1A) {
      // Estado 1: Sube — dobles 90°, normales 180° (via boardFlip para evitar conflicto con layout)
      result[i].x = lastPosA.x;
      result[i].y = lastPosA.y - (prevMetrics.radiusY + currMetrics.radiusY);
      result[i].rotation = currDouble ? 90 : 0;
      result[i].boardFlip = !currDouble;
    } else if (k === turn1A) {
      // Estado 2: Curva Derecha — nunca doble (postergación)
      // rotation=90 CW: b(bottom)→LEFT = enchufe hacia ficha anterior (Lado A: tile.b = enchufe)
      result[i].rotation = 90;
      const currRadiusX = TILE_H / 2;
      const currRadiusY = TILE_W / 2;
      result[i].x = lastPosA.x + (currRadiusX - prevMetrics.radiusX);
      result[i].y = lastPosA.y - (prevMetrics.radiusY + currRadiusY);
    } else if (k > turn1A && k < turn2A) {
      // Estado 3: Puente Horizontal a la Derecha — dobles VERTICALES, normales 90°
      // Motor: Lado A → tile.b = enchufe. rotation=90 CW: b(bottom)→LEFT = enchufe hacia ficha anterior
      const bridgeRadiusX = currDouble ? TILE_W / 2 : TILE_H / 2;
      result[i].rotation = currDouble ? 0 : 90;
      result[i].boardFlip = false;
      result[i].x = lastPosA.x + (prevMetrics.radiusX + bridgeRadiusX);
      result[i].y = lastPosA.y;
    } else if (k === turn2A) {
      // Estado 4: Curva Abajo — Nunca doble. Forzamos 180 grados.
      result[i].rotation = 180; 
      result[i].boardFlip = false;
      const currRadiusX = TILE_W / 2;
      const currRadiusY = TILE_H / 2;
      result[i].x = lastPosA.x + (prevMetrics.radiusX - currRadiusX);
      result[i].y = lastPosA.y + (prevMetrics.radiusY + currRadiusY);
    } else {
      // Estado 5: Baja — dobles 90°, normales 180°
      result[i].x = lastPosA.x;
      result[i].y = lastPosA.y + (prevMetrics.radiusY + currMetrics.radiusY);
      result[i].rotation = currDouble ? 90 : 180; // <- EL CAMBIO CLAVE
      result[i].boardFlip = false;
    }
    lastPosA = { x: result[i].x, y: result[i].y };
    lastDoubleA = Math.abs(result[i].rotation) === 90;
    updateExtents(result[i].x, result[i].y, getTileMetrics(lastDoubleA).radiusX, getTileMetrics(lastDoubleA).radiusY);
  }

  // Lado B (Baja -> Izquierda -> Sube): 5 estados (matemática opuesta)
  lastDoubleB = firstDouble;
  for (let k = 1; k < playedTiles.length - firstIndex; k++) {
    const i = firstIndex + k;
    const tile = result[i].tile;
    const currDouble = isDouble(tile);
    const prevMetrics = getTileMetrics(lastDoubleB);
    const currMetrics = getTileMetrics(currDouble);

    // Postergación: no girar con doble ni con la ficha siguiente al doble
    const prevTileB = result[firstIndex + k - 1]?.tile;
    const prevIsDoubleB = prevTileB ? isDouble(prevTileB) : false;
    if (k === turn1B && (currDouble || prevIsDoubleB)) {
      turn1B++;
      turn2B++;
    }
    if (k === turn2B && (currDouble || prevIsDoubleB)) {
      turn2B++;
    }

    if (k < turn1B) {
      // Estado 1: Baja — dobles 90°, normales 0°
      result[i].x = lastPosB.x;
      result[i].y = lastPosB.y + (prevMetrics.radiusY + currMetrics.radiusY);
      result[i].rotation = currDouble ? 90 : 0;
    } else if (k === turn1B) {
      // Estado 2: Curva Izquierda — nunca doble (postergación)
      result[i].rotation = 90;
      const currRadiusX = TILE_H / 2;
      const currRadiusY = TILE_W / 2;
      result[i].x = lastPosB.x - (currRadiusX - prevMetrics.radiusX);
      result[i].y = lastPosB.y + (prevMetrics.radiusY + currRadiusY);
    } else if (k > turn1B && k < turn2B) {
      // Estado 3: Puente Horizontal a la Izquierda — dobles van VERTICALES (perpendicular al puente)
      const bridgeRadiusX = currDouble ? TILE_W / 2 : TILE_H / 2;
      result[i].rotation = currDouble ? 0 : 90;
      result[i].x = lastPosB.x - (prevMetrics.radiusX + bridgeRadiusX);
      result[i].y = lastPosB.y;
    } else if (k === turn2B) {
      // Estado 4: Curva Arriba — Nunca doble. Forzamos 180 grados.
      result[i].rotation = 180;
      result[i].boardFlip = false;
      const currRadiusX = TILE_W / 2;
      const currRadiusY = TILE_H / 2;
      result[i].x = lastPosB.x - (prevMetrics.radiusX - currRadiusX);
      result[i].y = lastPosB.y - (prevMetrics.radiusY + currRadiusY);
    } else {
      // Estado 5: Sube — dobles 90°, normales 180°
      result[i].x = lastPosB.x;
      result[i].y = lastPosB.y - (prevMetrics.radiusY + currMetrics.radiusY);
      result[i].rotation = currDouble ? 90 : 180; // <- EL CAMBIO CLAVE
      result[i].boardFlip = false;
    }
    lastPosB = { x: result[i].x, y: result[i].y };
    lastDoubleB = Math.abs(result[i].rotation) === 90;
    updateExtents(result[i].x, result[i].y, getTileMetrics(lastDoubleB).radiusX, getTileMetrics(lastDoubleB).radiusY);
  }

  // Posiciones donde iría la siguiente ficha en cada extremo (para sombras clickeables)
  const endPositions = computeEndPositions({
    firstIndex,
    playedTiles,
    lastPosA,
    lastPosB,
    lastDoubleA,
    lastDoubleB,
    turn1A,
    turn2A,
    turn1B,
    turn2B,
    nextTile,
    getTileMetrics,
    isDouble,
  });

  return { positions: result, extents: { minX, maxX, minY, maxY }, endPositions };
}

/**
 * Calcula las coordenadas (x, y) y rotación donde iría la siguiente ficha en cada extremo.
 * Aplica la misma regla de postergación: no cruzar con dobles ni con la ficha consecutiva al doble.
 *
 * @returns {{ left: { x: number, y: number, rotation: number }, right: { x: number, y: number, rotation: number } }}
 */
function computeEndPositions({
  firstIndex,
  playedTiles,
  lastPosA,
  lastPosB,
  lastDoubleA,
  lastDoubleB,
  turn1A,
  turn2A,
  turn1B,
  turn2B,
  nextTile,
  getTileMetrics,
  isDouble,
}) {
  const currDouble = nextTile ? isDouble(nextTile) : false;
  const currMetrics = getTileMetrics(currDouble);
  const prevMetricsA = getTileMetrics(lastDoubleA);
  const prevMetricsB = getTileMetrics(lastDoubleB);

  const prevTileA = playedTiles[0]?.tile;
  const prevTileB = playedTiles[playedTiles.length - 1]?.tile;
  const prevIsDoubleA = prevTileA ? isDouble(prevTileA) : false;
  const prevIsDoubleB = prevTileB ? isDouble(prevTileB) : false;

  const kNextA = firstIndex + 1;
  const kNextB = playedTiles.length - firstIndex;

  const postponeAtTurn1A = kNextA === turn1A && (currDouble || prevIsDoubleA);
  const postponeAtTurn2A = kNextA === turn2A && (currDouble || prevIsDoubleA);
  const postponeAtTurn1B = kNextB === turn1B && (currDouble || prevIsDoubleB);
  const postponeAtTurn2B = kNextB === turn2B && (currDouble || prevIsDoubleB);

  let left = { x: lastPosA.x, y: lastPosA.y, rotation: 0 };
  let right = { x: lastPosB.x, y: lastPosB.y, rotation: 0 };

  // Lado A: siguiente posición (con postergación de curvas)
  if (kNextA < turn1A || postponeAtTurn1A) {
    left = {
      x: lastPosA.x,
      y: lastPosA.y - (prevMetricsA.radiusY + currMetrics.radiusY),
      rotation: currDouble ? 90 : 0,
    };
  } else if (kNextA === turn1A) {
    const currRadiusX = TILE_H / 2;
    const currRadiusY = TILE_W / 2;
    left = {
      x: lastPosA.x + (currRadiusX - prevMetricsA.radiusX),
      y: lastPosA.y - (prevMetricsA.radiusY + currRadiusY),
      rotation: 90,
    };
  } else if ((kNextA > turn1A && kNextA < turn2A) || postponeAtTurn2A) {
    const bridgeRadiusX = currDouble ? TILE_W / 2 : TILE_H / 2;
    left = {
      x: lastPosA.x + (prevMetricsA.radiusX + bridgeRadiusX),
      y: lastPosA.y,
      rotation: currDouble ? 0 : 90,
    };
  } else if (kNextA === turn2A) {
    const currRadiusX = TILE_W / 2;
    const currRadiusY = TILE_H / 2;
    left = {
      x: lastPosA.x + (prevMetricsA.radiusX - currRadiusX),
      y: lastPosA.y + (prevMetricsA.radiusY + currRadiusY),
      rotation: 180,
    };
  } else {
    left = {
      x: lastPosA.x,
      y: lastPosA.y + (prevMetricsA.radiusY + currMetrics.radiusY),
      rotation: currDouble ? 90 : 180,
    };
  }

  // Lado B: siguiente posición (con postergación de curvas)
  if (kNextB < turn1B || postponeAtTurn1B) {
    right = {
      x: lastPosB.x,
      y: lastPosB.y + (prevMetricsB.radiusY + currMetrics.radiusY),
      rotation: currDouble ? 90 : 0,
    };
  } else if (kNextB === turn1B) {
    const currRadiusX = TILE_H / 2;
    const currRadiusY = TILE_W / 2;
    right = {
      x: lastPosB.x - (currRadiusX - prevMetricsB.radiusX),
      y: lastPosB.y + (prevMetricsB.radiusY + currRadiusY),
      rotation: 90,
    };
  } else if ((kNextB > turn1B && kNextB < turn2B) || postponeAtTurn2B) {
    const bridgeRadiusX = currDouble ? TILE_W / 2 : TILE_H / 2;
    right = {
      x: lastPosB.x - (prevMetricsB.radiusX + bridgeRadiusX),
      y: lastPosB.y,
      rotation: currDouble ? 0 : 90,
    };
  } else if (kNextB === turn2B) {
    const currRadiusX = TILE_W / 2;
    const currRadiusY = TILE_H / 2;
    right = {
      x: lastPosB.x - (prevMetricsB.radiusX - currRadiusX),
      y: lastPosB.y - (prevMetricsB.radiusY + currRadiusY),
      rotation: 180,
    };
  } else {
    right = {
      x: lastPosB.x,
      y: lastPosB.y - (prevMetricsB.radiusY + currMetrics.radiusY),
      rotation: currDouble ? 90 : 180,
    };
  }

  return { left, right };
}
