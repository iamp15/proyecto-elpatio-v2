const FACTOR = 100;

/**
 * Convierte Piedras ingresadas por el usuario a sub-unidades para la DB.
 * Ejemplo: 5 piedras -> 500 sub-unidades.
 */
export const toSubunits = (stones) => Math.floor(stones * FACTOR);

/**
 * Convierte sub-unidades de la DB a Piedras enteras para mostrar.
 */
export const toStones = (subunits) => Math.floor(subunits / FACTOR);

/**
 * Comisión (rake) en subunidades, siempre múltiplo de 100 (piedras enteras).
 */
export const calculateRake = (amountSubunits, percentage) => {
  const raw = Math.floor(Number(amountSubunits) * (percentage / 100));
  return Math.floor(raw / FACTOR) * FACTOR;
};