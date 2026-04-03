const { BaseGame } = require('./BaseGame');

/**
 * Motor de juego de Dominó.
 *
 * Fichas: 28 piezas estándar (doble-6), cada una como { a, b } donde a <= b.
 * Reparto: 7 fichas por jugador. Las sobrantes van al stock.
 * Inicio: sale el jugador con el doble más alto; si ninguno tiene dobles, el que
 *         tiene la ficha de mayor denominación (a+b).
 * Turnos: rotación circular en playerOrder.
 * Fin: mano vacía (win) | juego bloqueado (todos pasan, gana menor pip sum).
 */
class DominoGame extends BaseGame {
  /**
   * @param {object} config
   * @param {number[]} playerIds
   */
  constructor(config, playerIds) {
    super(config, playerIds);

    // Estado privado — nunca sale del servidor
    /** @type {Object.<number, Array<{a:number,b:number}>>} */
    this._hands = {};
    /** @type {Array<{a:number,b:number}>} */
    this._stock = [];

    // Estado público
    /** @type {Array<{tile:{a:number,b:number}, side:'left'|'right'|'first', playedBy:number}>} */
    this.board         = [];
    this.boardEnds     = null; // { left: number, right: number } | null
    this.turn          = null; // userId con el turno activo
    this.playerOrder   = [...playerIds];
    /** @type {Object.<number, number>} */
    this.tileCount     = {};
    this.status        = 'WAITING'; // 'WAITING' | 'PLAYING' | 'FINISHED'
    this.winner        = null;
    this.consecutivePasses = 0;
    this._lastStarter = null;
    this.turnDuration = 30000; // 30 segundos en milisegundos
    this.turnStartTime = Date.now();

    // Sistema de puntos por liga
    /** @type {Object.<number, number>} */
    this.scores = {};
    this.playerOrder.forEach(uid => {
      this.scores[uid] = 0;
    });

    const league = this.config?.league || 'BRONCE';
    if (league === 'DIAMANTE') {
      this.targetScore = 100;
    } else if (league === 'ORO') {
      this.targetScore = 75;
    } else {
      this.targetScore = 50; // Bronce y Plata
    }
  }

  // ─── Utilidades privadas ──────────────────────────────────────────────────

  /** Genera las 28 fichas del juego de dominó. */
  _generateTiles() {
    const tiles = [];
    for (let a = 0; a <= 6; a++) {
      for (let b = a; b <= 6; b++) {
        tiles.push({ a, b });
      }
    }
    return tiles;
  }

  /** Mezcla un array in-place usando Fisher-Yates. */
  _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** Avanza el turno al siguiente jugador en el orden circular. */
  _nextTurn() {
    const idx = this.playerOrder.indexOf(this.turn);
    this.turn = this.playerOrder[(idx + 1) % this.playerOrder.length];
    this.turnStartTime = Date.now();
  }

  /**
   * Obtiene los extremos válidos donde una ficha puede jugarse.
   * @param {{a:number,b:number}} tile
   * @returns {Array<'left'|'right'>}
   */
  _getValidPositionsForTile(tile) {
    if (!this.boardEnds) return ['left'];
    const positions = [];
    if (tile.a === this.boardEnds.left || tile.b === this.boardEnds.left) {
      positions.push('left');
    }
    if (tile.a === this.boardEnds.right || tile.b === this.boardEnds.right) {
      positions.push('right');
    }
    return positions;
  }

  /**
   * Comprueba si un jugador tiene alguna ficha jugable dado el estado del tablero.
   * @param {number} userId
   * @returns {boolean}
   */
  _hasPlayableTile(userId) {
    if (!this.boardEnds) return true; // tablero vacío, cualquier ficha vale
    const { left, right } = this.boardEnds;
    return this._hands[userId].some(
      (t) => t.a === left || t.b === left || t.a === right || t.b === right,
    );
  }

  /**
   * Calcula la suma de puntos (pip sum) de la mano de un jugador.
   * @param {number} userId
   * @returns {number}
   */
  _pipSum(userId) {
    return this._hands[userId].reduce((sum, t) => sum + t.a + t.b, 0);
  }

  /**
   * Verifica si todos los jugadores tienen el stock vacío y no pueden jugar.
   * Condición de juego bloqueado.
   * @returns {boolean}
   */
  _isBlocked() {
    if (this._stock.length > 0) return false;
    return this.playerOrder.every((uid) => !this._hasPlayableTile(uid));
  }

  /**
   * Obtiene el doble más alto en la mano del jugador, o null si no tiene dobles.
   * @param {number} userId
   * @returns {number|null} Valor del doble (0-6) o null
   */
  _getHighestDouble(userId) {
    const doubles = this._hands[userId].filter((t) => t.a === t.b);
    if (doubles.length === 0) return null;
    return Math.max(...doubles.map((t) => t.a));
  }

  /**
   * Obtiene la suma máxima (a+b) de una ficha en la mano del jugador.
   * Solo considera fichas no dobles.
   * @param {number} userId
   * @returns {number}
   */
  _getHighestTileSum(userId) {
    const nonDoubles = this._hands[userId].filter((t) => t.a !== t.b);
    if (nonDoubles.length === 0) return -1;
    return Math.max(...nonDoubles.map((t) => t.a + t.b));
  }

  /**
   * Determina qué jugador sale primero según reglas tradicionales:
   * 1. Sale el que tiene el doble más alto.
   * 2. Si ninguno tiene dobles, sale el que tiene la ficha de mayor denominación (a+b).
   * @returns {number} userId del jugador que sale
   */
  _resolveFirstPlayer() {
    let bestDouble = -1;
    let winnerWithDouble = null;
    for (const uid of this.playerOrder) {
      const hd = this._getHighestDouble(uid);
      if (hd !== null && hd > bestDouble) {
        bestDouble = hd;
        winnerWithDouble = uid;
      }
    }
    if (winnerWithDouble !== null) return winnerWithDouble;

    let bestSum = -1;
    let winnerWithTile = null;
    for (const uid of this.playerOrder) {
      const s = this._getHighestTileSum(uid);
      if (s > bestSum) {
        bestSum = s;
        winnerWithTile = uid;
      }
    }
    return winnerWithTile ?? this.playerOrder[0];
  }

  /**
   * Construye el mapa de puntos finales (pip sum) de cada jugador.
   * El ganador que vacía la mano tiene 0 pips. En juego bloqueado,
   * cada jugador conserva los pips de sus fichas restantes.
   * @returns {Object.<number, number>}
   */
  _getFinalScores() {
    const scores = {};
    for (const uid of this.playerOrder) {
      scores[uid] = this._pipSum(uid);
    }
    return scores;
  }

  /**
   * Determina el ganador en un juego bloqueado (menor pip sum).
   * En caso de empate, gana el primero en el orden de turno.
   * @returns {number} userId del ganador
   */
  _resolveBlockedWinner() {
    let winner = this.playerOrder[0];
    let minPips = this._pipSum(winner);
    for (const uid of this.playerOrder.slice(1)) {
      const pips = this._pipSum(uid);
      if (pips < minPips) {
        minPips = pips;
        winner  = uid;
      }
    }
    return winner;
  }

  /**
   * Maneja el final de una mano, calcula los puntos y verifica la condición de victoria global.
   * @param {number} winnerId
   * @param {boolean} [isBlocked=false]
   * @returns {object} Resultado de la acción para el socket handler
   */
  _handleHandEnd(winnerId, isBlocked = false) {
    const handScores = this._getFinalScores(); // { uid: pips }

    let pointsWon = 0;

    if (isBlocked) {
      // REGLA DE LA DIFERENCIA: Puntos del rival - Puntos del ganador
      const winnerPips = handScores[winnerId] || 0;
      let opponentPips = 0;

      for (const uid in handScores) {
        if (String(uid) !== String(winnerId)) {
          opponentPips = handScores[uid];
        }
      }
      // El ganador suma la diferencia (mínimo 0 por seguridad)
      pointsWon = Math.max(0, opponentPips - winnerPips);
    } else {
      // REGLA CLÁSICA (Ganar por vaciar mano): Suma total de los puntos del rival
      for (const uid in handScores) {
        if (String(uid) !== String(winnerId)) {
          pointsWon += handScores[uid];
        }
      }
    }

    const revealedHands = {};
    for (const uid in this._hands) {
      revealedHands[uid] = this._hands[uid];
    }

    this.scores[winnerId] += pointsWon;

    if (this.scores[winnerId] >= this.targetScore) {
      this.status = 'FINISHED';
      this.winner = winnerId;
      return {
        gameOver: true,
        winnerId: winnerId,
        finalScores: this.scores,
        roundWinner: winnerId,
        pointsWon: pointsWon,
        revealedHands: revealedHands,
        isFinal: true,
        isBlocked: isBlocked
      };
    } else {
      // La mano terminó, pero la partida continúa
      this.status = 'WAITING_NEXT_ROUND';
      return {
        gameOver: false,
        roundOver: true,
        roundWinner: winnerId,
        pointsWon: pointsWon,
        currentScores: this.scores,
        revealedHands: revealedHands,
        isBlocked: isBlocked
      };
    }
  }

  // ─── Acciones privadas ────────────────────────────────────────────────────

  /**
   * Juega una ficha en el tablero.
   * @param {number} userId
   * @param {{a:number,b:number}} tile
   * @param {'left'|'right'} side
   */
  _playTile(userId, tile, side) {
    const hand = this._hands[userId];

    // Retirar la ficha de la mano (comparar por valor, no referencia)
    const idx = hand.findIndex((t) => t.a === tile.a && t.b === tile.b);
    hand.splice(idx, 1);

    if (this.board.length === 0) {
      // Primera jugada
      this.board.push({ tile, side: 'first', playedBy: userId });
      this.boardEnds = { left: tile.a, right: tile.b };
    } else if (side === 'left') {
      const leftEnd = this.boardEnds.left;
      // Orientar la ficha correctamente al extremo izquierdo
      const orientedTile = tile.b === leftEnd ? tile : { a: tile.b, b: tile.a };
      this.board.unshift({ tile: orientedTile, side: 'left', playedBy: userId });
      this.boardEnds.left = orientedTile.a;
    } else {
      const rightEnd = this.boardEnds.right;
      const orientedTile = tile.a === rightEnd ? tile : { a: tile.b, b: tile.a };
      this.board.push({ tile: orientedTile, side: 'right', playedBy: userId });
      this.boardEnds.right = orientedTile.b;
    }

    this.tileCount[userId] = hand.length;
    this.consecutivePasses = 0;
  }

  /**
   * El jugador roba una ficha del stock.
   * @param {number} userId
   * @returns {{a:number,b:number}} La ficha robada
   */
  _drawTile(userId) {
    const tile = this._stock.pop();
    this._hands[userId].push(tile);
    this.tileCount[userId] = this._hands[userId].length;
    this.consecutivePasses = 0;
    return tile;
  }

  /**
   * El jugador pasa su turno.
   */
  _pass() {
    this.consecutivePasses += 1;
  }

  // ─── Métodos públicos (implementación de BaseGame) ────────────────────────

  /**
   * Inicializa el estado: genera fichas, mezcla, reparte y establece el primer turno.
   */
  start(overrideStarter = null) {
    const tiles = this._shuffle(this._generateTiles());
    const tilesPerPlayer = 7;

    this.playerOrder.forEach((uid, i) => {
      this._hands[uid]  = tiles.slice(i * tilesPerPlayer, (i + 1) * tilesPerPlayer);
      this.tileCount[uid] = tilesPerPlayer;
    });

    this._stock = tiles.slice(this.playerOrder.length * tilesPerPlayer);

    this.turn = overrideStarter ?? this._resolveFirstPlayer();
    this._lastStarter = this.turn;
    this.status = 'PLAYING';
    this.turnStartTime = Date.now();
  }

  /**
   * Valida la acción sin modificar el estado.
   *
   * @param {number} userId
   * @param {{ actionType: 'play_tile'|'draw_tile'|'pass', tile?: {a:number,b:number}, side?: 'left'|'right' }} data
   * @returns {{ valid: boolean, reason?: string }}
   */
  validateMove(userId, data) {
    if (this.status !== 'PLAYING') {
      return { valid: false, reason: 'La partida no está en curso.' };
    }

    if (this.turn !== userId) {
      return { valid: false, reason: 'No es tu turno.' };
    }

    const { actionType, tile, side } = data;

    if (actionType === 'play_tile') {
      if (!tile || tile.a === undefined || tile.b === undefined) {
        return { valid: false, reason: 'Datos de ficha inválidos.' };
      }

      // Verificar que la ficha esté en la mano del jugador
      const hand = this._hands[userId] ?? [];
      const hasTile = hand.some((t) => t.a === tile.a && t.b === tile.b);
      if (!hasTile) {
        return { valid: false, reason: 'No tienes esa ficha en tu mano.' };
      }

      // Tablero vacío: cualquier ficha es válida
      if (!this.boardEnds) {
        return { valid: true };
      }

      if (side !== 'left' && side !== 'right') {
        return { valid: false, reason: 'Debes indicar el extremo: "left" o "right".' };
      }

      const end = this.boardEnds[side];
      const fits = tile.a === end || tile.b === end;
      if (!fits) {
        return { valid: false, reason: `La ficha [${tile.a}|${tile.b}] no encaja en el extremo ${side} (${end}).` };
      }

      return { valid: true };
    }

    if (actionType === 'draw_tile') {
      if (this._stock.length === 0) {
        return { valid: false, reason: 'El stock está vacío.' };
      }
      return { valid: true };
    }

    if (actionType === 'pass') {
      // Solo se puede pasar si no hay fichas jugables y el stock está vacío
      if (this._hasPlayableTile(userId)) {
        return { valid: false, reason: 'Tienes fichas que puedes jugar. No puedes pasar.' };
      }
      if (this._stock.length > 0) {
        return { valid: false, reason: 'Hay fichas en el stock. Debes robar antes de pasar.' };
      }
      return { valid: true };
    }

    return { valid: false, reason: `Acción desconocida: ${actionType}` };
  }

  /**
   * Aplica la acción y actualiza el estado. Detecta fin de partida.
   *
   * @param {number} userId
   * @param {{ actionType: string, tile?: object, side?: string }} data
   * @returns {{ gameOver: boolean, winnerId: number|null }}
   */
  handleAction(userId, data) {
    const { actionType, tile, side } = data;

    if (actionType === 'play_tile') {
      this._playTile(userId, tile, side);

      // Win: jugador vació su mano
      if (this._hands[userId].length === 0) {
        return this._handleHandEnd(userId);
      }
    } else if (actionType === 'draw_tile') {
      this._drawTile(userId);
      // El turno sigue siendo del mismo jugador; reiniciamos el reloj para que
      // tenga 30 segundos más antes de que el autoplay vuelva a actuar.
      this.turnStartTime = Date.now();
      return { gameOver: false, roundOver: false, winnerId: null, finalScores: null };
    } else if (actionType === 'pass') {
      this._pass();

      // Juego bloqueado: todos han pasado consecutivamente
      if (this.consecutivePasses >= this.playerOrder.length || this._isBlocked()) {
        const winner = this._resolveBlockedWinner();
        return this._handleHandEnd(winner, true);
      }
    }

    this._nextTurn();
    return { gameOver: false, roundOver: false, winnerId: null, finalScores: null };
  }

  /**
   * Simula el autoplay sin modificar el estado del juego y devuelve la secuencia
   * de acciones a ejecutar. El pozo real se copia para respetar el orden de robo.
   *
   * @returns {Array<{actionType: string, tile?: object, side?: string}>}
   */
  _planAutoPlay() {
    const currentPlayerId = this.turn;
    const simulatedHand  = [...(this._hands[currentPlayerId] ?? [])];
    const simulatedStock = [...this._stock]; // copia: pop() desde el final igual que _drawTile
    const plan = [];

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const validMoves = [];
      simulatedHand.forEach((tile) => {
        const positions = this._getValidPositionsForTile(tile);
        if (positions.length > 0) validMoves.push({ tile, position: positions[0] });
      });

      if (validMoves.length > 0) {
        validMoves.sort((a, b) => (b.tile.a + b.tile.b) - (a.tile.a + a.tile.b));
        const best = validMoves[0];
        plan.push({ actionType: 'play_tile', tile: { a: best.tile.a, b: best.tile.b }, side: best.position });
        break;
      }

      if (simulatedStock.length > 0) {
        const drawn = simulatedStock.pop();
        simulatedHand.push(drawn);
        plan.push({ actionType: 'draw_tile' });
        continue;
      }

      plan.push({ actionType: 'pass' });
      break;
    }

    return plan;
  }

  /**
   * Verifica si el turno actual excedió el tiempo límite.
   * Devuelve el plan de acciones a ejecutar, o null si el tiempo no expiró.
   *
   * @returns {{ timedOutPlayerId: number, plan: Array } | null}
   */
  checkTimeouts() {
    if (this.status !== 'PLAYING') return null;

    if (Date.now() - this.turnStartTime >= this.turnDuration) {
      return {
        timedOutPlayerId: this.turn,
        plan: this._planAutoPlay(),
      };
    }
    return null;
  }

  /**
   * Resultado de abandono voluntario: gana el oponente y se usan
   * los puntajes acumulados actuales para el resumen final.
   *
   * @param {number} forfeitingUserId
   * @returns {{ winnerId: number|null, finalScores: Object.<number, number> }}
   */
  getForfeitResult(forfeitingUserId) {
    const winnerId = this.playerOrder.find((uid) => String(uid) !== String(forfeitingUserId)) ?? null;
    return {
      winnerId,
      finalScores: { ...this.scores },
    };
  }

  /**
   * Limpia el tablero y reparte fichas nuevas para la siguiente ronda.
   */
  startNextRound() {
    this.board = [];
    this.boardEnds = null;
    this.consecutivePasses = 0;

    const lastIdx = this.playerOrder.indexOf(this._lastStarter);
    const nextStarter = this.playerOrder[(lastIdx + 1) % this.playerOrder.length];

    this.start(nextStarter);
  }

  /**
   * Devuelve el estado del juego personalizado para el jugador solicitante.
   * Las manos de los oponentes solo se exponen como conteo de fichas.
   *
   * @param {number} forUserId
   * @returns {object}
   */
  getState(forUserId) {
    const opponentCounts = {};
    for (const uid of this.playerOrder) {
      if (uid !== forUserId) {
        opponentCounts[uid] = this.tileCount[uid];
      }
    }

    return {
      board:             this.board,
      boardEnds:         this.boardEnds,
      turn:              this.turn,
      playerOrder:       this.playerOrder,
      hand:              this._hands[forUserId] ?? [],
      opponentTileCounts: opponentCounts,
      stockCount:        this._stock.length,
      status:            this.status,
      winner:            this.winner,
      consecutivePasses: this.consecutivePasses,
      turnEndsAt:        this.turnStartTime + this.turnDuration,
      scores:            this.scores,
      targetScore:       this.targetScore,
    };
  }
}

module.exports = { DominoGame };
