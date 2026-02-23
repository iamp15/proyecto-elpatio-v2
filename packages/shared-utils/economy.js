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
 * Calcula una comisión (Rake) y devuelve el entero en sub-unidades.
 */
export const calculateRake = (amountSubunits, percentage) => {
  return Math.floor(amountSubunits * (percentage / 100));
};