import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap } from 'lucide-react';
import { io } from 'socket.io-client';
import { useAuth } from '../../../context/AuthContext';
import iconoPiedras from '../../../assets/icono-piedras-2.png';
import './domino.css';

const GAME_SERVER_URL = import.meta.env.VITE_GAME_SERVER_URL || 'http://localhost:3001';

// #region agent log
const DEBUG_LOG = (message, data, hypothesisId) => {
  try {
    fetch('http://127.0.0.1:7764/ingest/70fafe70-a2bf-4dc7-ac86-bc9d961d6e39', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'b25a51' }, body: JSON.stringify({ sessionId: 'b25a51', location: 'LobbyDomino.jsx', message, data: data ?? {}, hypothesisId: hypothesisId ?? null, timestamp: Date.now() }) }).catch(() => {});
  } catch (_) {}
};
// #endregion

/**
 * Constantes visuales por rango (puramente de UI: colores y emoji).
 * La fuente de verdad para minPR, maxPR, entryFee, etc. viene del servidor
 * a través del evento init_lobby_config.
 */
const RANK_VISUAL = {
  BRONCE:   { emoji: '🥉', colorA: '#cd7f32', colorB: '#8b5a00', colorARaw: '205,127,50'  },
  PLATA:    { emoji: '🥈', colorA: '#c5cdd3', colorB: '#697a85', colorARaw: '197,205,211' },
  ORO:      { emoji: '🥇', colorA: '#ffd54f', colorB: '#b8860b', colorARaw: '255,213,79'  },
  DIAMANTE: { emoji: '💎', colorA: '#80deea', colorB: '#006680', colorARaw: '128,222,234' },
};

/** Orden de rangos (menor = más bajo). Solo se bloquean categorías MAYORES al rango del usuario. */
const RANK_ORDER = ['BRONCE', 'PLATA', 'ORO', 'DIAMANTE'];

/** Devuelve el nivel de un rango (0 = Bronce, 3 = Diamante). Desconocidos = -1. */
function getRankLevel(rankId) {
  const idx = RANK_ORDER.indexOf(rankId);
  return idx >= 0 ? idx : -1;
}

/**
 * true si la categoría está desbloqueada para el usuario.
 * Regla: desbloqueadas la categoría del usuario y todas las inferiores; bloqueadas las superiores.
 * Ej: usuario en Plata → desbloqueadas Bronce y Plata; bloqueadas Oro y Diamante.
 */
function isCategoryUnlocked(userRank, categoryId) {
  const userLevel     = getRankLevel(userRank);
  const categoryLevel = getRankLevel(categoryId);
  if (categoryLevel < 0) return true;  // categoría desconocida: permitir
  if (userLevel < 0) return true;      // usuario sin rango: permitir
  return categoryLevel <= userLevel;
}

/**
 * Normaliza los datos que llegan del servidor (JSON no serializa Infinity)
 * y los fusiona con las constantes visuales.
 * @param {object[]} serverCategories - Array recibido en init_lobby_config
 * @returns {object[]} Categorías listas para renderizar
 */
function mergeWithVisuals(serverCategories) {
  return serverCategories.map((cat) => {
    const visual = RANK_VISUAL[cat.categoryId] ?? {};
    const entryFee = Math.round(cat.entryFee_subunits / 100);
    const pot      = Math.floor(cat.entryFee_subunits * cat.maxPlayers * 0.8 / 100);
    return {
      ...cat,
      maxPR:    (cat.maxPR === null || cat.maxPR === undefined) ? Infinity : cat.maxPR,
      entryFee,
      pot,
      ...visual,
    };
  });
}

/** Calcula el progreso de PR dentro del rango actual hacia el siguiente. */
function calcPRProgress(userPR, categories) {
  const idx     = categories.findIndex((c) => userPR >= c.minPR && userPR <= c.maxPR);
  const current = categories[idx];
  const next    = categories[idx + 1];
  if (!current || !next) return 1;
  return Math.min(1, Math.max(0, (userPR - current.minPR) / (next.minPR - current.minPR)));
}

function StoneIcon({ size = 16, style }) {
  return (
    <img
      src={iconoPiedras}
      alt=""
      width={size}
      height={size}
      style={{ objectFit: 'contain', flexShrink: 0, ...style }}
      aria-hidden="true"
    />
  );
}

function LockIcon({ size = 28 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

/**
 * Skeleton animado mientras se carga la configuración del servidor.
 */
function CategorySkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.04, 0.1, 0.04] }}
          transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.15 }}
          style={{
            height: 150,
            borderRadius: 20,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        />
      ))}
    </div>
  );
}

/** Bloque pulsante genérico para estados de carga. */
function SkeletonPill({ width = 80, height = 20, radius = 99 }) {
  return (
    <motion.div
      animate={{ opacity: [0.06, 0.14, 0.06] }}
      transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
      style={{
        width,
        height,
        borderRadius: radius,
        background: 'rgba(255,255,255,0.18)',
        flexShrink: 0,
      }}
    />
  );
}

/**
 * Header dinámico con avatar, badge de rango y barra de progreso de PR.
 * Mientras isSyncing=true muestra skeletons animados en lugar de datos reales.
 */
function RankHeader({ user, userPR, userRank, balance, categories, isSyncing, t }) {
  const currentCat = categories.find((c) => c.categoryId === userRank) ?? categories[0];
  const nextCat    = categories[categories.indexOf(currentCat) + 1];
  const progress   = categories.length ? calcPRProgress(userPR, categories) : 0;
  const isMaxRank  = !nextCat;

  const displayName  = user?.first_name ?? user?.username ?? t('lobby.defaultPlayerName');
  const avatarLetter = displayName[0]?.toUpperCase() ?? '?';

  const cssVars = currentCat ? {
    '--cat-a':     currentCat.colorA,
    '--cat-b':     currentCat.colorB,
    '--cat-a-raw': currentCat.colorARaw,
  } : {};

  return (
    <div className="lobby-rank-header" style={cssVars}>
      <div className="lobby-rank-header-top">
        <div className="lobby-rank-header-left">
          <div className="lobby-rank-avatar">
            {user?.photo_url ? (
              <img src={user.photo_url} alt={displayName} className="lobby-rank-avatar-img" />
            ) : (
              <div className="lobby-rank-avatar-placeholder">{avatarLetter}</div>
            )}
          </div>

          <div className="lobby-rank-header-info">
            <div className="lobby-rank-header-name">{displayName}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AnimatePresence mode="wait">
                {isSyncing ? (
                  <motion.div
                    key="badge-skeleton"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <SkeletonPill width={88} height={24} radius={99} />
                  </motion.div>
                ) : currentCat ? (
                  <motion.span
                    key={`badge-${userRank}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.35 }}
                    className={`domino-rank-badge domino-rank-badge--lg domino-rank-badge--${userRank}`}
                  >
                    {currentCat.emoji} {t('ranks.' + (currentCat.categoryId || 'bronce').toLowerCase())}
                  </motion.span>
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {isSyncing ? (
            <motion.div
              key="balance-skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="lobby-rank-header-balance-pill"
            >
              <SkeletonPill width={56} height={28} radius={99} />
            </motion.div>
          ) : balance != null ? (
            <motion.div
              key="balance-value"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.35 }}
              className="lobby-rank-header-balance-pill"
            >
              <StoneIcon size={14} />
              <span>{balance}</span>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="lobby-pr-section">
        <div className="lobby-pr-labels">
          <AnimatePresence mode="wait">
            {isSyncing ? (
              <motion.div
                key="pr-skeleton"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <SkeletonPill width={70} height={26} radius={8} />
              </motion.div>
            ) : (
              <motion.span
                key={`pr-${userPR}`}
                className="lobby-pr-current"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.35 }}
              >
                {userPR} {t('lobby.prLabel')}
              </motion.span>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {!isSyncing && (
              <motion.span
                key={`pr-label-${userRank}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.35, delay: 0.1 }}
              >
                {isMaxRank ? (
                  <span className="lobby-pr-max-label">{t('lobby.maxRank')}</span>
                ) : nextCat ? (
                  <span className="lobby-pr-next-label">
                    {t('lobby.prToNext', { count: nextCat.minPR - userPR, next: t('ranks.' + (nextCat.categoryId || 'bronce').toLowerCase()) })}
                  </span>
                ) : null}
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <div className="lobby-pr-bar-track">
          <motion.div
            className="lobby-pr-bar-fill"
            initial={{ width: 0 }}
            animate={{ width: isSyncing ? 0 : `${progress * 100}%` }}
            transition={{ duration: 0.9, ease: [0.4, 0, 0.2, 1] }}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Card de categoría. Los datos (minPR, maxPR, entryFee, pot) vienen del servidor
 * fusionados con las constantes visuales (emoji, colores).
 * Si isActiveRank, aplica resplandor pulsante, shimmer y badge "ESTÁS AQUÍ".
 * isComingSoon: desbloqueada por rango pero matchmaking no disponible (ej. ORO/DIAMANTE).
 */
function CategoryCard({ cat, isEligible, isComingSoon, index, onSelect, isActiveRank, t }) {
  const maxDisplay = cat.maxPR === Infinity ? '∞' : cat.maxPR;
  const glowColor = `rgba(${cat.colorARaw}, 0.45)`;

  const cssVars = {
    '--cat-a':     cat.colorA,
    '--cat-b':     cat.colorB,
    '--cat-a-raw': cat.colorARaw,
  };

  const cardClass = [
    'lobby-category-card',
    !isEligible && !isComingSoon ? 'lobby-category-card--locked' : '',
    isComingSoon ? 'lobby-category-card--coming-soon' : '',
    isActiveRank ? 'lobby-category-card--active-rank' : '',
  ].filter(Boolean).join(' ');

  return (
    <motion.div
      className={cardClass}
      style={cssVars}
      initial={{ opacity: 0, y: 24 }}
      animate={{
        opacity: 1,
        y: 0,
        ...(isActiveRank && {
          boxShadow: [
            `0 0 0px ${glowColor}`,
            `0 0 20px ${glowColor}`,
            `0 0 0px ${glowColor}`,
          ],
        }),
      }}
      transition={{
        opacity: { duration: 0.35, delay: index * 0.08, ease: [0.4, 0, 0.2, 1] },
        y: { duration: 0.35, delay: index * 0.08, ease: [0.4, 0, 0.2, 1] },
        ...(isActiveRank && {
          boxShadow: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
        }),
      }}
    >
      {isActiveRank && (
        <>
          <motion.div
            className="lobby-card-shimmer"
            style={{ willChange: 'transform' }}
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.span
            className="lobby-card-active-badge"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            style={{ willChange: 'transform' }}
          >
            {t('lobby.youAreHere')}
          </motion.span>
        </>
      )}

      {!isEligible && !isComingSoon && (
        <div className="lobby-card-lock-icon">
          <LockIcon size={28} />
        </div>
      )}

      <div className="lobby-card-top">
        <span className="lobby-card-emoji">{cat.emoji}</span>
      </div>

      <div>
        <div className="lobby-card-title">{t('ranks.' + (cat.categoryId || 'bronce').toLowerCase())}</div>
        <div className="lobby-card-pr-range">{t('lobby.prLabel')} {cat.minPR}–{maxDisplay}</div>
      </div>

      <div className="lobby-card-chips">
        <div className="lobby-card-chip">
          <span className="lobby-card-chip-label">{t('lobby.entry')}</span>
          <span className="lobby-card-chip-value">
            <StoneIcon size={12} />
            {cat.entryFee}
          </span>
        </div>
        <div className="lobby-card-chip">
          <span className="lobby-card-chip-label">{t('lobby.estimatedPrize')}</span>
          <span className="lobby-card-chip-value">
            <StoneIcon size={12} />
            {cat.pot}
          </span>
        </div>
      </div>

      <motion.button
        className="lobby-card-play-btn"
        onClick={() => isEligible && onSelect(cat)}
        disabled={!isEligible}
        whileTap={isEligible ? {
          scale: 0.94,
          boxShadow: `0 0 0 3px ${cat.colorA}, 0 0 20px ${cat.colorA}55`,
          transition: { duration: 0.1 },
        } : {}}
        aria-label={isEligible ? t('lobby.playCategory', { category: t('ranks.' + (cat.categoryId || 'bronce').toLowerCase()) }) : isComingSoon ? t('lobby.comingSoon') : t('lobby.locked')}
      >
        {isEligible ? t('lobby.play') : isComingSoon ? t('lobby.comingSoon') : t('lobby.locked')}
      </motion.button>
    </motion.div>
  );
}

/** Componente principal del Lobby de Dominó. */
export default function LobbyDomino() {
  const { t } = useTranslation();
  const { token, balance, user, updateUser, isSyncingProfile } = useAuth();
  const navigate = useNavigate();

  const userPR   = user?.pr   ?? 1000;
  const userRank = user?.rank ?? 'BRONCE';

  const [categories,     setCategories]     = useState([]);    // cargado desde el servidor
  const [view,           setView]           = useState('SELECT_MODE');
  const [activeCategory, setActiveCategory] = useState(null);
  const [allowLowerLeague, setAllowLowerLeague] = useState(false);
  const [error,          setError]          = useState('');
  const socketRef    = useRef(null);
  const configLoaded = useRef(false);

  // #region agent log
  useEffect(() => {
    DEBUG_LOG('LobbyDomino displaying user data', { userPR, userRank, balance, isSyncingProfile }, 'H5');
  }, [userPR, userRank, balance, isSyncingProfile]);
  // #endregion

  // Fuerza fondo oscuro mientras el lobby está montado
  useEffect(() => {
    const prev = document.body.style.getPropertyValue('--color-bg');
    document.body.style.setProperty('--color-bg', '#0d1117');
    return () => {
      if (prev) {
        document.body.style.setProperty('--color-bg', prev);
      } else {
        document.body.style.removeProperty('--color-bg');
      }
    };
  }, []);

  // Conexión de configuración: carga init_lobby_config al montar
  useEffect(() => {
    if (!token || configLoaded.current) return;

    const configSocket = io(`${GAME_SERVER_URL}/domino`, {
      auth:       { token },
      transports: ['websocket'],
    });

    configSocket.once('init_lobby_config', ({ categories: serverCats }) => {
      setCategories(mergeWithVisuals(serverCats));
      configLoaded.current = true;
      configSocket.disconnect();
    });

    configSocket.on('connect_error', () => {
      configSocket.disconnect();
    });

    return () => {
      configSocket.disconnect();
    };
  }, [token]);

  // Limpiar socket de matchmaking al desmontar
  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  const connectAndJoin = useCallback((categoryId, allowLower = false) => {
    if (!token) return;
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const socket = io(`${GAME_SERVER_URL}/domino`, {
      auth:       { token },
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_queue', { categoryId, allowLowerLeague: allowLower });
    });

    // Actualizar la config si el servidor la reenvía (reconexión, etc.)
    socket.on('init_lobby_config', ({ categories: serverCats }) => {
      setCategories(mergeWithVisuals(serverCats));
    });

    socket.on('match_found', () => {
      // Partida encontrada, game_start llegará a continuación
    });

    socket.on('game_start', (payload) => {
      socket.disconnect();
      socketRef.current = null;
      navigate(`/juegos/domino/${payload.roomId}`, { state: { fromMatchmaking: true } });
    });

    socket.on('pr_updated', ({ pr, rank }) => {
      updateUser({ pr, rank });
    });

    socket.on('pr_out_of_range', (payload) => {
      setError(payload.message ?? t('lobby.errorPrOutOfRange'));
      setView('SELECT_MODE');
      socket.disconnect();
      socketRef.current = null;
    });

    socket.on('insufficient_balance', (payload) => {
      setError(payload.message ?? t('lobby.errorInsufficientBalance'));
      setView('SELECT_MODE');
      socket.disconnect();
      socketRef.current = null;
    });

    socket.on('queue_reset', (payload) => {
      setError(payload.message ?? t('lobby.errorQueueReset'));
      setView('SELECT_MODE');
      socket.disconnect();
      socketRef.current = null;
    });

    socket.on('error', (payload) => {
      setError(payload.message ?? t('lobby.errorServer'));
      setView('SELECT_MODE');
      socket.disconnect();
      socketRef.current = null;
    });

    socket.on('disconnect', () => {
      if (view === 'IN_QUEUE') {
        setView('SELECT_MODE');
      }
    });
  }, [token, navigate, view, updateUser, t]);

  function handleSelectCategory(cat) {
    setError('');
    setActiveCategory(cat);
    setView('IN_QUEUE');
    connectAndJoin(cat.categoryId, allowLowerLeague);
  }

  function handleCancel() {
    if (socketRef.current?.connected) {
      socketRef.current.emit('leave_queue');
    }
    socketRef.current?.disconnect();
    socketRef.current = null;
    setView('SELECT_MODE');
    setActiveCategory(null);
    setError('');
  }

  return (
    <div className="domino-lobby">

      {/* ── Header con rango y barra PR ─────────────────────────────────── */}
      <RankHeader
        user={user}
        userPR={userPR}
        userRank={userRank}
        balance={balance}
        categories={categories}
        isSyncing={isSyncingProfile}
        t={t}
      />

      {/* ── Toast de error ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {error && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="domino-lobby-error"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Vistas ─────────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">

        {/* ── SELECT_MODE ── */}
        {view === 'SELECT_MODE' && (
          <motion.div
            key="select"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            style={{ flex: 1 }}
          >
            <p className="domino-lobby-section-title">{t('lobby.chooseCategory')}</p>

            {(getRankLevel(userRank) >= 1 || (categories[0] && userPR >= (categories.find((c) => c.categoryId === 'PLATA')?.minPR ?? 1000))) && (
              <label className="lobby-allow-lower-league">
                <input
                  type="checkbox"
                  checked={allowLowerLeague}
                  onChange={(e) => setAllowLowerLeague(e.target.checked)}
                  className="lobby-allow-lower-league-input"
                />
                <span className="lobby-allow-lower-league-switch" aria-hidden />
                <span className="lobby-allow-lower-league-label">
                  <Zap size={16} strokeWidth={2} aria-hidden />
                  {t('lobby.allowLowerLeague')}
                </span>
              </label>
            )}

            {categories.length === 0 ? (
              <CategorySkeleton />
            ) : (
              <div className="lobby-category-grid">
                {categories.map((cat, i) => {
                  const rankUnlocked = isCategoryUnlocked(userRank, cat.categoryId);
                  const isEligible = rankUnlocked && cat.maxPlayers === 2;
                  const isComingSoon = rankUnlocked && cat.maxPlayers !== 2;
                  const isActiveRank = cat.categoryId === userRank;
                  return (
                    <CategoryCard
                      key={cat.categoryId}
                      cat={cat}
                      isEligible={isEligible}
                      isComingSoon={isComingSoon}
                      index={i}
                      onSelect={handleSelectCategory}
                      isActiveRank={isActiveRank}
                      t={t}
                    />
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* ── IN_QUEUE ── */}
        {view === 'IN_QUEUE' && activeCategory && (
          <motion.div
            key="queue"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="domino-lobby-queue"
          >
            <div
              className="domino-lobby-queue-inner"
              style={{
                '--cat-a':     activeCategory.colorA,
                '--cat-b':     activeCategory.colorB,
                '--cat-a-raw': activeCategory.colorARaw,
                background: `linear-gradient(145deg, rgba(${activeCategory.colorARaw},0.08) 0%, rgba(0,0,0,0.2) 100%)`,
                borderColor: `${activeCategory.colorA}33`,
              }}
            >
              <div style={{ position: 'relative', width: 64, height: 64 }}>
                <div
                  className="lobby-queue-spinner"
                  style={{ '--cat-a': activeCategory.colorA }}
                />
                <div className="domino-lobby-queue-center-icon">
                  <motion.span
                    style={{ fontSize: '1.7rem', lineHeight: 1 }}
                    animate={{ scale: [1, 1.12, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    {activeCategory.emoji}
                  </motion.span>
                </div>
              </div>

              <div>
                <p className="domino-lobby-queue-title">{t('lobby.searchingOpponent')}</p>
                <p className="domino-lobby-queue-sub">
                  {t('ranks.' + (activeCategory.categoryId || 'bronce').toLowerCase())} · {t('lobby.prLabel')} {activeCategory.minPR}–{activeCategory.maxPR === Infinity ? '∞' : activeCategory.maxPR}
                </p>
              </div>

              <button
                className="domino-btn domino-btn-danger"
                onClick={handleCancel}
              >
                {t('lobby.cancel')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
