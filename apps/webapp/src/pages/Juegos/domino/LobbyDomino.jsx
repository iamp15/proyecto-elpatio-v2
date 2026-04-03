import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useDominoSocket } from '../../../context/DominoSocketContext';
import { useAudioSettings } from '../../../context/AudioSettingsContext';
import iconoPiedras from '../../../assets/icono-piedras-2.png';
import useGameSounds from './hooks/useGameSounds';
import InsufficientBalanceModal from './components/InsufficientBalanceModal';
import './domino.css';
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
 * rankMatchReady: rango y modo 2 jugadores OK (sin candado de liga).
 * playDisabled: no se puede pulsar Jugar (liga bloqueada, próximamente o saldo sin cargar).
 * playDisabledReason: motivo para texto/aria cuando playDisabled (no incluye saldo insuficiente: ahí se abre modal).
 */
function CategoryCard({
  cat,
  rankMatchReady,
  playDisabled,
  playDisabledReason,
  isComingSoon,
  index,
  onPlayRequest,
  isActiveRank,
  onPlayButton,
  t,
}) {
  const maxDisplay = cat.maxPR === Infinity ? '∞' : cat.maxPR;
  const glowColor = `rgba(${cat.colorARaw}, 0.45)`;

  const cssVars = {
    '--cat-a':     cat.colorA,
    '--cat-b':     cat.colorB,
    '--cat-a-raw': cat.colorARaw,
  };

  const cardClass = [
    'lobby-category-card',
    !rankMatchReady && !isComingSoon ? 'lobby-category-card--locked' : '',
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

      {!rankMatchReady && !isComingSoon && (
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
        onClick={() => {
          if (playDisabled) return;
          onPlayButton?.();
          onPlayRequest(cat);
        }}
        disabled={playDisabled}
        whileTap={!playDisabled ? {
          scale: 0.94,
          boxShadow: `0 0 0 3px ${cat.colorA}, 0 0 20px ${cat.colorA}55`,
          transition: { duration: 0.1 },
        } : {}}
        aria-label={
          !playDisabled
            ? t('lobby.playCategory', { category: t('ranks.' + (cat.categoryId || 'bronce').toLowerCase()) })
            : isComingSoon
              ? t('lobby.comingSoon')
              : !rankMatchReady
                ? t('lobby.locked')
                : playDisabledReason === 'balance_loading'
                  ? t('lobby.balanceLoadingShort')
                  : playDisabledReason === 'balance_unavailable'
                    ? t('lobby.balanceUnavailableShort')
                    : t('lobby.locked')
        }
      >
        {!playDisabled
          ? t('lobby.play')
          : isComingSoon
            ? t('lobby.comingSoon')
            : !rankMatchReady
              ? t('lobby.locked')
              : playDisabledReason === 'balance_loading'
                ? t('lobby.balanceLoadingShort')
                : playDisabledReason === 'balance_unavailable'
                  ? t('lobby.balanceUnavailableShort')
                  : t('lobby.locked')}
      </motion.button>
    </motion.div>
  );
}

/** Componente principal del Lobby de Dominó. */
export default function LobbyDomino() {
  const { t } = useTranslation();
  const {
    token,
    balance,
    balanceSubunits,
    balanceLoading,
    balanceError,
    user,
    updateUser,
    isSyncingProfile,
  } = useAuth();
  const { socket, lobbyServerCategories } = useDominoSocket();
  const navigate = useNavigate();
  const { playButton, playLobbyMusic, stopLobbyMusic } = useGameSounds();
  const { settings: audioSettings } = useAudioSettings();

  const userPR   = user?.pr   ?? 1000;
  const userRank = user?.rank ?? 'BRONCE';

  const categories = useMemo(
    () => mergeWithVisuals(lobbyServerCategories ?? []),
    [lobbyServerCategories],
  );
  const [view,           setView]           = useState('SELECT_MODE');
  const [activeCategory, setActiveCategory] = useState(null);
  const [allowLowerLeague, setAllowLowerLeague] = useState(false);
  const [error,          setError]          = useState('');
  const [insufficientBalanceModal, setInsufficientBalanceModal] = useState({
    open: false,
    serverMessage: null,
  });
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const navigateRef = useRef(navigate);
  const updateUserRef = useRef(updateUser);
  const tRef = useRef(t);
  navigateRef.current = navigate;
  updateUserRef.current = updateUser;
  tRef.current = t;

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

  // Música del lobby: arranca si no está silenciada; reacciona a Ajustes (mute música / todo).
  useEffect(() => {
    if (audioSettings.masterMute || audioSettings.musicMute) {
      stopLobbyMusic();
    } else {
      playLobbyMusic();
    }
    return () => stopLobbyMusic();
  }, [audioSettings.masterMute, audioSettings.musicMute, playLobbyMusic, stopLobbyMusic]);

  // Matchmaking sobre el socket global (DominoSocketProvider).
  // No incluir `t`, `navigate`, `updateUser` en deps: suelen cambiar de referencia y el cleanup
  // dispararía leave_queue en bucle, vaciando la cola antes de que el tick empareje.
  const queueCategoryId = view === 'IN_QUEUE' && activeCategory ? activeCategory.categoryId : null;

  useEffect(() => {
    if (!socket || view !== 'IN_QUEUE' || !queueCategoryId) return undefined;

    const categoryId = queueCategoryId;
    const allowLower = allowLowerLeague;

    const emitJoin = () => {
      socket.emit('join_queue', { categoryId, allowLowerLeague: allowLower });
    };

    const onGameStart = (payload) => {
      navigateRef.current(`/juegos/domino/${payload.roomId}`, { state: { fromMatchmaking: true } });
    };

    const onPrUpdated = ({ pr, rank }) => {
      updateUserRef.current({ pr, rank });
    };

    const onPrOutOfRange = (payload) => {
      setError(payload.message ?? tRef.current('lobby.errorPrOutOfRange'));
      setView('SELECT_MODE');
      setActiveCategory(null);
    };

    const onInsufficientBalance = (payload) => {
      setInsufficientBalanceModal({
        open: true,
        serverMessage: payload?.message ?? null,
      });
      setView('SELECT_MODE');
      setActiveCategory(null);
      setError('');
    };

    const onQueueReset = (payload) => {
      setError(payload.message ?? tRef.current('lobby.errorQueueReset'));
      setView('SELECT_MODE');
      setActiveCategory(null);
    };

    const onServerError = (payload) => {
      setError(payload.message ?? tRef.current('lobby.errorServer'));
      setView('SELECT_MODE');
      setActiveCategory(null);
    };

    const onDisconnectWhileQueue = () => {
      if (viewRef.current === 'IN_QUEUE') {
        setView('SELECT_MODE');
        setActiveCategory(null);
      }
    };

    if (socket.connected) emitJoin();
    socket.on('connect', emitJoin);
    socket.on('game_start', onGameStart);
    socket.on('pr_updated', onPrUpdated);
    socket.on('pr_out_of_range', onPrOutOfRange);
    socket.on('insufficient_balance', onInsufficientBalance);
    socket.on('queue_reset', onQueueReset);
    socket.on('error', onServerError);
    socket.on('disconnect', onDisconnectWhileQueue);

    return () => {
      socket.off('connect', emitJoin);
      socket.off('game_start', onGameStart);
      socket.off('pr_updated', onPrUpdated);
      socket.off('pr_out_of_range', onPrOutOfRange);
      socket.off('insufficient_balance', onInsufficientBalance);
      socket.off('queue_reset', onQueueReset);
      socket.off('error', onServerError);
      socket.off('disconnect', onDisconnectWhileQueue);
      socket.emit('leave_queue');
    };
  }, [socket, view, queueCategoryId, allowLowerLeague]);

  function handlePlayCategory(cat) {
    setError('');
    if (!token) return;
    if (balanceLoading) {
      setError(t('lobby.balanceLoadingShort'));
      return;
    }
    if (balanceSubunits === null) {
      setError(
        balanceError
          ? t('lobby.balanceUnavailableShort')
          : t('lobby.balanceLoadingShort'),
      );
      return;
    }
    const fee = cat.entryFee_subunits ?? 0;
    if (fee > 0 && balanceSubunits < fee) {
      setInsufficientBalanceModal({ open: true, serverMessage: null });
      return;
    }
    setActiveCategory(cat);
    setView('IN_QUEUE');
  }

  function handleCancel() {
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

      <InsufficientBalanceModal
        open={insufficientBalanceModal.open}
        serverMessage={insufficientBalanceModal.serverMessage}
        onClose={() => setInsufficientBalanceModal({ open: false, serverMessage: null })}
        onGoToStore={() => {}}
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

            {lobbyServerCategories === null ? (
              <CategorySkeleton />
            ) : (
              <div className="lobby-category-grid">
                {categories.map((cat, i) => {
                  const rankUnlocked = isCategoryUnlocked(userRank, cat.categoryId);
                  const rankMatchReady = rankUnlocked && cat.maxPlayers === 2;
                  const isComingSoon = rankUnlocked && cat.maxPlayers !== 2;
                  const saldoListo = !balanceLoading && balanceSubunits !== null;
                  let playDisabled = true;
                  let playDisabledReason = null;
                  if (isComingSoon) {
                    playDisabled = true;
                    playDisabledReason = null;
                  } else if (!rankMatchReady) {
                    playDisabled = true;
                    playDisabledReason = null;
                  } else if (balanceLoading) {
                    playDisabled = true;
                    playDisabledReason = 'balance_loading';
                  } else if (balanceSubunits === null) {
                    playDisabled = true;
                    playDisabledReason = balanceError ? 'balance_unavailable' : 'balance_loading';
                  } else {
                    playDisabled = false;
                  }
                  const isActiveRank = cat.categoryId === userRank;
                  return (
                    <CategoryCard
                      key={cat.categoryId}
                      cat={cat}
                      rankMatchReady={rankMatchReady}
                      playDisabled={playDisabled}
                      playDisabledReason={playDisabledReason}
                      isComingSoon={isComingSoon}
                      index={i}
                      onPlayRequest={handlePlayCategory}
                      onPlayButton={playButton}
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
                onClick={() => {
                  playButton();
                  handleCancel();
                }}
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
