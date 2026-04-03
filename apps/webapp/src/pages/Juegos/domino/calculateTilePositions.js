const TILE_W = 40;
const TILE_H = 80;

const MAX_TILES_VERTICAL = 4;
const MAX_TILES_HORIZONTAL = 2; // Más corto para pantallas móviles

// Lado A: Crece globalmente hacia la IZQUIERDA
const DIRECTION_SEQUENCE_A = ['UP', 'LEFT', 'DOWN', 'LEFT'];
// Lado B: Crece globalmente hacia la DERECHA
const DIRECTION_SEQUENCE_B = ['DOWN', 'RIGHT', 'UP', 'RIGHT'];

const DEFAULT_EXTENTS = { minX: 0, maxX: 0, minY: 0, maxY: 0 };

/**
 * Obtiene los radios de la ficha basándose en su dirección física (vertical u horizontal).
 */
const getPhysicalMetrics = (isDouble, dir) => {
  const isVertical = (dir === 'UP' || dir === 'DOWN');
  if (isVertical) {
    return {
      radiusX: isDouble ? TILE_H / 2 : TILE_W / 2, // Doble: 40, Normal: 20
      radiusY: isDouble ? TILE_W / 2 : TILE_H / 2, // Doble: 20, Normal: 40
    };
  } else {
    return {
      radiusX: isDouble ? TILE_W / 2 : TILE_H / 2, // Doble: 20, Normal: 40
      radiusY: isDouble ? TILE_H / 2 : TILE_W / 2, // Doble: 40, Normal: 20
    };
  }
};

/**
 * Mapeo exacto de rotaciones para garantizar que los enchufes coincidan en ambos lados.
 */
const getRotation = (dir, isDouble, isSideA) => {
  if (isSideA) {
    if (dir === 'UP') return isDouble ? 90 : 0;
    if (dir === 'RIGHT') return isDouble ? 0 : 90;
    if (dir === 'DOWN') return isDouble ? 90 : 180;
    if (dir === 'LEFT') return isDouble ? 0 : -90;
  } else {
    if (dir === 'DOWN') return isDouble ? 90 : 0;
    if (dir === 'LEFT') return isDouble ? 0 : 90;
    if (dir === 'UP') return isDouble ? 90 : 180;
    if (dir === 'RIGHT') return isDouble ? 0 : -90;
  }
};

function advanceCursor(cursor, tile, directionSequence, isSideA) {
  const isDouble = (t) => t.a === t.b;
  const currDouble = isDouble(tile);
  const dir = directionSequence[cursor.directionIndex];

  const isVertical = (dir === 'UP' || dir === 'DOWN');
  // Si es vertical, el límite debe compensar el desplazamiento del tramo anterior
  const limit = isVertical ? cursor.verticalOffset + MAX_TILES_VERTICAL : MAX_TILES_HORIZONTAL;

  const canTurn = !currDouble && !(cursor.prevWasDouble ?? cursor.lastDouble);
  const mustTurn = cursor.tilesInRow >= limit && canTurn;

  let activeDir = dir;
  let nextDirectionIndex = cursor.directionIndex;
  let nextTilesInRow = cursor.tilesInRow + 1;
  let nextTurnCount = cursor.turnCount; // contador de giros
  let nextVerticalOffset = cursor.verticalOffset;

  if (mustTurn) {
    nextDirectionIndex = (cursor.directionIndex + 1) % 4;
    activeDir = directionSequence[nextDirectionIndex];
    nextTilesInRow = 1;
    nextTurnCount = cursor.turnCount + 1; // incrementa al girar

    // Si terminamos un tramo vertical, calculamos qué tan lejos quedamos del centro real
    if (isVertical) {
      nextVerticalOffset = Math.abs(cursor.tilesInRow - cursor.verticalOffset);
    }
  }

  const prevMetrics = getPhysicalMetrics(cursor.lastDouble, dir);
  const currMetrics = getPhysicalMetrics(currDouble, activeDir);

  let x = cursor.x;
  let y = cursor.y;

  if (mustTurn) {
    if (dir === 'UP' && activeDir === 'RIGHT') {
      x = cursor.x + currMetrics.radiusX - prevMetrics.radiusX;
      y = cursor.y - prevMetrics.radiusY - currMetrics.radiusY;
    } else if (dir === 'UP' && activeDir === 'LEFT') {
      x = cursor.x - currMetrics.radiusX + prevMetrics.radiusX;
      y = cursor.y - prevMetrics.radiusY - currMetrics.radiusY;
    } else if (dir === 'DOWN' && activeDir === 'RIGHT') {
      x = cursor.x + currMetrics.radiusX - prevMetrics.radiusX;
      y = cursor.y + prevMetrics.radiusY + currMetrics.radiusY;
    } else if (dir === 'DOWN' && activeDir === 'LEFT') {
      x = cursor.x - currMetrics.radiusX + prevMetrics.radiusX;
      y = cursor.y + prevMetrics.radiusY + currMetrics.radiusY;
    } else if (dir === 'RIGHT' && activeDir === 'UP') {
      x = cursor.x + prevMetrics.radiusX + currMetrics.radiusX;
      y = cursor.y - currMetrics.radiusY + prevMetrics.radiusY;
    } else if (dir === 'RIGHT' && activeDir === 'DOWN') {
      x = cursor.x + prevMetrics.radiusX + currMetrics.radiusX;
      y = cursor.y + currMetrics.radiusY - prevMetrics.radiusY;
    } else if (dir === 'LEFT' && activeDir === 'UP') {
      x = cursor.x - prevMetrics.radiusX - currMetrics.radiusX;
      y = cursor.y - currMetrics.radiusY + prevMetrics.radiusY;
    } else if (dir === 'LEFT' && activeDir === 'DOWN') {
      x = cursor.x - prevMetrics.radiusX - currMetrics.radiusX;
      y = cursor.y + currMetrics.radiusY - prevMetrics.radiusY;
    }
  } else {
    // Tramo recto
    if (activeDir === 'UP') {
      y = cursor.y - (prevMetrics.radiusY + currMetrics.radiusY);
    } else if (activeDir === 'RIGHT') {
      x = cursor.x + (prevMetrics.radiusX + currMetrics.radiusX);
    } else if (activeDir === 'DOWN') {
      y = cursor.y + (prevMetrics.radiusY + currMetrics.radiusY);
    } else if (activeDir === 'LEFT') {
      x = cursor.x - (prevMetrics.radiusX + currMetrics.radiusX);
    }
  }

  const rotation = getRotation(activeDir, currDouble, isSideA);

  const newCursor = {
    x, y,
    directionIndex: nextDirectionIndex,
    tilesInRow: nextTilesInRow,
    lastDouble: currDouble,
    prevWasDouble: currDouble,
    turnCount: nextTurnCount,
    verticalOffset: nextVerticalOffset,
  };

  return { cursor: newCursor, x, y, rotation, radiusX: currMetrics.radiusX, radiusY: currMetrics.radiusY };
}

export function calculateTilePositions(playedTiles, nextTile = null) {
  if (!playedTiles || playedTiles.length === 0) {
    return { positions: [], extents: DEFAULT_EXTENTS, endPositions: null };
  }

  const firstIndex = playedTiles.findIndex((e) => e.side === 'first');
  if (firstIndex === -1) {
    return { positions: playedTiles.map((e) => ({ ...e, x: 0, y: 0, rotation: 0 })), extents: DEFAULT_EXTENTS, endPositions: null };
  }

  const isDouble = (tile) => tile.a === tile.b;
  const firstDouble = isDouble(playedTiles[firstIndex].tile);
  const result = playedTiles.map((entry) => ({ ...entry, x: 0, y: 0, rotation: 0 }));

  let minX = 0, maxX = 0, minY = 0, maxY = 0;
  const updateExtents = (x, y, rx, ry) => {
    minX = Math.min(minX, x - rx); maxX = Math.max(maxX, x + rx);
    minY = Math.min(minY, y - ry); maxY = Math.max(maxY, y + ry);
  };

  const initialMetrics = getPhysicalMetrics(firstDouble, 'UP'); // Ficha inicial es vertical por defecto
  result[firstIndex].x = 0; result[firstIndex].y = 0; result[firstIndex].rotation = firstDouble ? 90 : 0;
  updateExtents(0, 0, initialMetrics.radiusX, initialMetrics.radiusY);

  let cursorA = { x: 0, y: 0, directionIndex: 0, tilesInRow: 0, lastDouble: firstDouble, prevWasDouble: firstDouble, turnCount: 0, verticalOffset: 0 };
  let cursorB = { x: 0, y: 0, directionIndex: 0, tilesInRow: 0, lastDouble: firstDouble, prevWasDouble: firstDouble, turnCount: 0, verticalOffset: 0 };

  for (let k = 1; k <= firstIndex; k++) {
    const i = firstIndex - k;
    const { cursor: nextCursor, x, y, rotation, radiusX, radiusY } = advanceCursor(cursorA, result[i].tile, DIRECTION_SEQUENCE_A, true);
    result[i].x = x; result[i].y = y; result[i].rotation = rotation;
    cursorA = nextCursor;
    updateExtents(x, y, radiusX, radiusY);
  }

  for (let k = 1; k < playedTiles.length - firstIndex; k++) {
    const i = firstIndex + k;
    const { cursor: nextCursor, x, y, rotation, radiusX, radiusY } = advanceCursor(cursorB, result[i].tile, DIRECTION_SEQUENCE_B, false);
    result[i].x = x; result[i].y = y; result[i].rotation = rotation;
    cursorB = nextCursor;
    updateExtents(x, y, radiusX, radiusY);
  }

  const endPositions = computeEndPositions(cursorA, cursorB, nextTile);
  return { positions: result, extents: { minX, maxX, minY, maxY }, endPositions };
}

function computeEndPositions(cursorA, cursorB, nextTile) {
  if (!nextTile) {
    return {
      left: { x: cursorA.x, y: cursorA.y, rotation: 0 },
      right: { x: cursorB.x, y: cursorB.y, rotation: 0 },
    };
  }
  const leftStep = advanceCursor(cursorA, nextTile, DIRECTION_SEQUENCE_A, true);
  const rightStep = advanceCursor(cursorB, nextTile, DIRECTION_SEQUENCE_B, false);
  return {
    left: { x: leftStep.x, y: leftStep.y, rotation: leftStep.rotation },
    right: { x: rightStep.x, y: rightStep.y, rotation: rightStep.rotation },
  };
}
