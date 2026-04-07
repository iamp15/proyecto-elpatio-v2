const {
  RESERVED_NICKNAME_WORDS,
  OFFENSIVE_NICKNAME_WORDS,
} = require('./nicknameDictionaries');

const NICKNAME_FORMAT = /^[a-zA-Z0-9]{3,12}$/;

const MSG_FORMAT =
  'El nickname debe tener entre 3 y 12 letras/números';
const MSG_COMMUNITY =
  'Nickname no permitido por reglas de la comunidad';

const LEET_MAP = {
  4: 'a',
  3: 'e',
  1: 'i',
  0: 'o',
  5: 's',
};

/**
 * Minúsculas + sustitución de dígitos usados como letras (anti-leetspeak).
 */
function normalizeForTrollCheck(s) {
  const lower = s.toLowerCase();
  let out = '';
  for (let i = 0; i < lower.length; i += 1) {
    const ch = lower[i];
    out += LEET_MAP[ch] !== undefined ? LEET_MAP[ch] : ch;
  }
  return out;
}

function containsAnySubstring(haystack, words) {
  for (let i = 0; i < words.length; i += 1) {
    if (haystack.includes(words[i])) {
      return true;
    }
  }
  return false;
}

/**
 * @param {unknown} raw
 * @returns {{ ok: true, nickname: string } | { ok: false, message: string }}
 */
function validateNickname(raw) {
  if (typeof raw !== 'string') {
    return { ok: false, message: MSG_FORMAT };
  }

  const trimmed = raw.trim();
  if (!NICKNAME_FORMAT.test(trimmed)) {
    return { ok: false, message: MSG_FORMAT };
  }

  const normalized = normalizeForTrollCheck(trimmed);
  if (containsAnySubstring(normalized, RESERVED_NICKNAME_WORDS)) {
    return { ok: false, message: MSG_COMMUNITY };
  }
  if (containsAnySubstring(normalized, OFFENSIVE_NICKNAME_WORDS)) {
    return { ok: false, message: MSG_COMMUNITY };
  }

  return { ok: true, nickname: trimmed };
}

module.exports = {
  validateNickname,
};
