/**
 * Catálogo de cosméticos (avatars, frames, badges) disponibles.
 * Define los items y sus condiciones de desbloqueo.
 */

// --- AVATARS ---
const AVATARS = [
  {
    id: 'telegram',
    name: 'Foto de Telegram',
    description: 'Usa la foto de perfil de Telegram si está disponible',
    unlockType: 'auto',
    requires: null,
    unlockedByDefault: true,
  },
  {
    id: 'default',
    name: 'Iniciales con gradiente',
    description: 'Iniciales con gradiente del color de tu liga',
    unlockType: 'auto',
    requires: null,
    unlockedByDefault: true,
  },
  {
    id: 'vip_gold',
    name: 'Avatar VIP Dorado',
    description: 'Avatar exclusivo para miembros VIP',
    unlockType: 'vip',
    requires: { vip: true },
    unlockedByDefault: false,
  },
  {
    id: 'halloween',
    name: 'Avatar de Halloween',
    description: 'Edición limitada de Halloween',
    unlockType: 'event',
    requires: { event: 'halloween_2025' },
    unlockedByDefault: false,
  },
];

// --- FRAMES ---
const FRAMES = [
  {
    id: 'rank',
    name: 'Marco de Liga',
    description: 'Color según tu rango actual',
    unlockType: 'auto',
    requires: null,
    unlockedByDefault: true,
  },
  {
    id: 'vip_gold',
    name: 'Marco VIP Dorado',
    description: 'Marco dorado con brillos, exclusivo VIP',
    unlockType: 'vip',
    requires: { vip: true },
    unlockedByDefault: false,
  },
  {
    id: 'vip_silver',
    name: 'Marco VIP Plateado',
    description: 'Marco plateado con brillos, exclusivo VIP',
    unlockType: 'vip',
    requires: { vip: true },
    unlockedByDefault: false,
  },
  {
    id: 'diamond_sparkle',
    name: 'Marco Diamante',
    description: 'Destellos de diamante para rango DIAMANTE',
    unlockType: 'rank',
    requires: { minRank: 'DIAMANTE' },
    unlockedByDefault: false,
  },
  {
    id: 'gold_sparkle',
    name: 'Marco Oro Brillante',
    description: 'Destellos de oro para rango ORO o superior',
    unlockType: 'rank',
    requires: { minRank: 'ORO' },
    unlockedByDefault: false,
  },
  {
    id: 'halloween_frame',
    name: 'Marco de Calabaza',
    description: 'Marco temático de Halloween',
    unlockType: 'event',
    requires: { event: 'halloween_2025' },
    unlockedByDefault: false,
  },
];

// --- BADGES ---
const BADGES = [
  {
    id: 'default',
    name: 'Estrella',
    description: 'Badge básico con estrella',
    unlockType: 'auto',
    context: 'global',
    requires: null,
    unlockedByDefault: true,
  },
  {
    id: 'vip',
    name: 'Corona› VIP',
    description: 'Corona para miembros VIP',
    unlockType: 'vip',
    context: 'global',
    requires: { vip: true },
    unlockedByDefault: false,
  },
  {
    id: 'torneo',
    name: 'Rayo› de Torneo',
    description: 'Badge por participar en torneos',
    unlockType: 'achievement',
    context: 'domino',
    requires: { achievement: 'tournament_participant' },
    unlockedByDefault: false,
  },
  {
    id: 'fundador',
    name: 'Escudo› de Fundador',
    description: 'Exclusivo para fundadores de la plataforma',
    unlockType: 'special',
    context: 'global',
    requires: { special: 'founder' },
    unlockedByDefault: false,
  },
  {
    id: 'winner',
    name: 'Trofeo› de Ganador',
    description: 'Badge por ganar 10 partidas',
    unlockType: 'achievement',
    context: 'domino',
    requires: { gamesWon: 10 },
    unlockedByDefault: false,
  },
  {
    id: 'streak',
    name: 'Llama› de Racha',
    description: 'Badge por racha› de victorias',
    unlockType: 'achievement',
    context: 'domino',
    requires: { winStreak: 5 },
    unlockedByDefault: false,
  },
];

const ALL_ITEMS = {
  avatars: AVATARS,
  frames: FRAMES,
  badges: BADGES,
};

/**
 * Busca un badge por su ID.
 * @param {string} id
 * @returns {Object|null} Badge encontrado o null.
 */
function getBadgeById(id) {
  return BADGES.find((b) => b.id === id);
}

/**
 * Determina qué items están desbloqueados para un usuario según sus datos.
 * @param {Object} user - Objeto usuario (con vip_status, rank, stats, inventory, etc.)
 * @returns {Object} Objeto con arrays de IDs desbloqueados por categoría.
 */
function getUnlockedItems(user) {
  const vip = user?.vip_status?.is_vip === true;
  const rank = user?.rank || 'BRONCE';
  const stats = user?.stats || {};
  const inventory = user?.inventory || { avatars: [], frames: [], badges: [] };

  // Rangos ordenados por prestigio
  const rankOrder = { BRONCE: 0, PLATA: 1, ORO: 2, DIAMANTE: 3 };

  const unlocked = {
    avatars: [...inventory.avatars],
    frames: [...inventory.frames],
    badges: [...inventory.badges],
  };

  // Avatars
  AVATARS.forEach((item) => {
    if (item.unlockedByDefault && !unlocked.avatars.includes(item.id)) {
      unlocked.avatars.push(item.id);
    }
    if (item.unlockType === 'vip' && vip) {
      if (!unlocked.avatars.includes(item.id)) unlocked.avatars.push(item.id);
    }
    // Otras lógicas de desbloqueo se pueden añadir aquí
  });

  // Frames
  FRAMES.forEach((item) => {
    if (item.unlockedByDefault && !unlocked.frames.includes(item.id)) {
      unlocked.frames.push(item.id);
    }
    if (item.unlockType === 'vip' && vip) {
      if (!unlocked.frames.includes(item.id)) unlocked.frames.push(item.id);
    }
    if (item.unlockType === 'rank' && item.requires?.minRank) {
      const minRank = item.requires.minRank;
      if (rankOrder[rank] >= rankOrder[minRank]) {
        if (!unlocked.frames.includes(item.id)) unlocked.frames.push(item.id);
      }
    }
  });

  // Badges
  BADGES.forEach((item) => {
    if (item.unlockedByDefault && !unlocked.badges.includes(item.id)) {
      unlocked.badges.push(item.id);
    }
    if (item.unlockType === 'vip' && vip) {
      if (!unlocked.badges.includes(item.id)) unlocked.badges.push(item.id);
    }
    if (item.unlockType === 'achievement') {
      if (item.requires?.gamesWon && stats.games_won >= item.requires.gamesWon) {
        if (!unlocked.badges.includes(item.id)) unlocked.badges.push(item.id);
      }
    }
  });

  // Asegurar que no haya duplicados
  unlocked.avatars = [...new Set(unlocked.avatars)];
  unlocked.frames = [...new Set(unlocked.frames)];
  unlocked.badges = [...new Set(unlocked.badges)];

  return unlocked;
}

module.exports = {
  AVATARS,
  FRAMES,
  BADGES,
  ALL_ITEMS,
  getUnlockedItems,
  getBadgeById,
};