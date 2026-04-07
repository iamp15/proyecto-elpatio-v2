/**
 * Palabras reservadas (comparación sobre cadena normalizada en minúsculas).
 */
const RESERVED_NICKNAME_WORDS = [
  'admin',
  'administrador',
  'bot',
  'soporte',
  'elpatio',
  'elpati0',
  'sistema',
  'moderador',
  'staff',
  'official',
  'oficial',
];

/**
 * Términos ofensivos habituales (español); amplía con jerga local según necesidad.
 */
const OFFENSIVE_NICKNAME_WORDS = [
  'puta',
  'puto',
  'mierda',
  'idiota',
  'imbecil',
  'imbécil',
  'estupido',
  'estúpido',
  'maricon',
  'maricón',
  'nazi',
  'hitler',
];

module.exports = {
  RESERVED_NICKNAME_WORDS,
  OFFENSIVE_NICKNAME_WORDS,
};
