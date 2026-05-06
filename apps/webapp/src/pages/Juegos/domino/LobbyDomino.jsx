import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../../context/AuthContext';
import { useInventory } from '../../../context/InventoryContext';
import { useDominoSocket } from '../../../context/DominoSocketContext';
import { useAudioSettings } from '../../../context/AudioSettingsContext';
import iconoPiedras from '../../../assets/icono-piedras-2.png';
import useGameSounds from './hooks/useGameSounds';
import { resolveDisplayName } from '../../../lib/userDisplayName';
import { isVipUser, vipDisplayNameStyleOnDark } from '../../../lib/vipUserUi';
import { getLeagueCouponMeta, getLeagueCouponQuantity } from '../../../lib/inventory/leagueCoupons';
import BackHomeButton from '../../../components/navigation/BackHomeButton';
import InsufficientBalanceModal from './components/InsufficientBalanceModal';
import CrossLeagueHelpModal from './components/CrossLeagueHelpModal';
import PlayerVipCapsule from './components/PlayerVipCapsule';
import LeagueCard from './components/leagueCard';
import LeaguePromotionModal from './components/LeaguePromotionModal';
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

/** Normaliza el rank del usuario a categoryId en mayúsculas (la API y el CSS usan BRONCE, PLATA, …). */
function normalizeLeagueId(rankId) {
  if (rankId == null || typeof rankId !== 'string') return 'BRONCE';
  const u = rankId.trim().toUpperCase();
  return RANK_ORDER.includes(u) ? u : 'BRONCE';
}

/**
 * Misma regla que el game-server (getRankForPR): última categoría cuyo minPR <= pr.
 * Solo como respaldo si el usuario no tiene `rank` en perfil.
 */
function leagueFromPR(pr, sortedByMinPR) {
  const n = Number(pr);
  const prSafe = Number.isFinite(n) ? n : 0;
  let categoryId = sortedByMinPR[0]?.categoryId ?? 'BRONCE';
  for (const c of sortedByMinPR) {
    if (prSafe >= c.minPR) categoryId = c.categoryId;
  }
  return categoryId;
}

/** true si el documento user trae liga persistida (campo rank). */
function hasPersistedRank(user) {
  const r = user?.rank;
  if (r == null) return false;
  if (typeof r !== 'string') return false;
  return r.trim() !== '';
}

/** Devuelve el nivel de un rango (0 = Bronce, 3 = Diamante). Desconocidos = -1. */
function getRankLevel(rankId) {
  const idx = RANK_ORDER.indexOf(normalizeLeagueId(rankId));
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
  const list = Array.isArray(serverCategories) ? serverCategories : [];
  return [...list]
    .filter(
      (cat) =>
        cat != null
        && typeof cat === 'object'
        && cat.categoryId != null
        && String(cat.categoryId).trim() !== '',
    )
    .map((raw) => ({ ...raw, categoryId: String(raw.categoryId).toUpperCase() }))
    .sort((a, b) => (a.minPR ?? 0) - (b.minPR ?? 0))
    .map((cat) => {
      const visual = RANK_VISUAL[cat.categoryId] ?? {};
      const feeSu = Number(cat.entryFee_subunits);
      const entryFee = Number.isFinite(feeSu) ? Math.round(feeSu / 100) : 0;
      return {
        ...cat,
        maxPR: (cat.maxPR === null || cat.maxPR === undefined) ? Infinity : cat.maxPR,
        entryFee,
        ...visual,
      };
    });
}

/**
 * Progreso de PR (0–1) desde el suelo de la liga indicada por `displayRankId` hasta el minPR de la siguiente.
 * La liga mostrada viene de user.rank; el PR indica cuánto falta para el siguiente escalón.
 */
function calcPRProgressForRank(userPR, categories, displayRankId) {
  if (!categories.length) return 0;
  const sorted = [...categories].sort((a, b) => a.minPR - b.minPR);
  const pr = Number(userPR);
  const prSafe = Number.isFinite(pr) ? pr : 0;
  const rankId = normalizeLeagueId(displayRankId);
  const idx = sorted.findIndex((c) => c.categoryId === rankId);
  if (idx < 0) return 0;
  const current = sorted[idx];
  const next = sorted[idx + 1];
  if (!next) return 1;
  const span = next.minPR - current.minPR;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (prSafe - current.minPR) / span));
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
function RankHeader({ user, userPR, userRank, balance, categories, isSyncing, leaguesLoading, t }) {
  const currentCat =
    categories.length > 0
      ? (categories.find((c) => c.categoryId === userRank) ?? categories[0])
      : null;
  const nextCat =
    currentCat != null && categories.length > 0
      ? categories[categories.indexOf(currentCat) + 1]
      : null;
  const progress = categories.length ? calcPRProgressForRank(userPR, categories, userRank) : 0;
  const isMaxRank = Boolean(categories.length && currentCat && !nextCat);

  const displayName = resolveDisplayName(user, t('lobby.defaultPlayerName'));
  const avatarLetter = displayName[0]?.toUpperCase() ?? '?';

  const visualFallback = RANK_VISUAL[userRank] ?? {};
  const cssVars = currentCat
    ? {
        '--cat-a':     currentCat.colorA,
        '--cat-b':     currentCat.colorB,
        '--cat-a-raw': currentCat.colorARaw,
      }
    : {
        '--cat-a':     visualFallback.colorA,
        '--cat-b':     visualFallback.colorB,
        '--cat-a-raw': visualFallback.colorARaw,
      };

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
            {isVipUser(user) ? (
              <div className="lobby-rank-avatar-vip">
                <PlayerVipCapsule compact />
              </div>
            ) : null}
          </div>

          <div className="lobby-rank-header-info">
            <div
              className="lobby-rank-header-name"
              style={isVipUser(user) ? vipDisplayNameStyleOnDark() : undefined}
            >
              {displayName}
            </div>
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
                ) : (
                  <motion.span
                    key={`badge-fallback-${userRank}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.35 }}
                    className={`domino-rank-badge domino-rank-badge--lg domino-rank-badge--${userRank}`}
                  >
                    {visualFallback.emoji ?? '🥉'}{' '}
                    {t('ranks.' + (userRank || 'bronce').toLowerCase())}
                  </motion.span>
                )}
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
                key={`pr-label-${userRank}-${categories.length}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.35, delay: 0.1 }}
              >
                {leaguesLoading && categories.length === 0 ? (
                  <span className="lobby-pr-next-label">{t('lobby.loadingLeagues')}</span>
                ) : isMaxRank ? (
                  <span className="lobby-pr-max-label">{t('lobby.maxRank')}</span>
                ) : nextCat ? (
                  <span className="lobby-pr-next-label">
                    {t('lobby.prToNext', { count: Math.max(0, nextCat.minPR - userPR), next: t('ranks.' + (nextCat.categoryId || 'bronce').toLowerCase()) })}
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
    refreshUser,
    isSyncingProfile,
    api,
  } = useAuth();
  const { inventory } = useInventory();
  const { socket, lobbyServerCategories, connected } = useDominoSocket();

  const requestLobbyConfig = useCallback(() => {
    if (socket?.connected) socket.emit('request_lobby_config');
  }, [socket]);
  const navigate = useNavigate();
  const { playButton, playLobbyMusic, stopLobbyMusic } = useGameSounds();
  const { settings: audioSettings } = useAudioSettings();

  const userPR = user?.pr ?? 1000;

  const categories = useMemo(
    () => mergeWithVisuals(lobbyServerCategories ?? []),
    [lobbyServerCategories],
  );

  const couponQuantitiesByLeague = useMemo(
    () => Object.fromEntries(
      categories.map((cat) => [
        cat.categoryId,
        getLeagueCouponQuantity(inventory, cat.categoryId),
      ]),
    ),
    [categories, inventory],
  );

  /**
   * Liga actual en UI: el campo `rank` del usuario en BD (misma semántica que el game-server al validar cola).
   * Si aún no hay rank persistido, se infiere por PR como respaldo.
   */
  const effectiveRank = useMemo(() => {
    if (hasPersistedRank(user)) return normalizeLeagueId(user.rank);
    if (categories.length > 0) return leagueFromPR(userPR, categories);
    return 'BRONCE';
  }, [user, user?.rank, categories, userPR]);
  const [view,           setView]           = useState('SELECT_MODE');
  const [activeCategory, setActiveCategory] = useState(null);
  const [allowCrossLeague, setAllowCrossLeague] = useState(false);
  const [crossLeagueHelpOpen, setCrossLeagueHelpOpen] = useState(false);
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [promotedLeague, setPromotedLeague] = useState(null);
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

  useEffect(() => {
    if (!token) return;
    refreshUser?.();
  }, [token, refreshUser]);

  useEffect(() => {
    const pendingPromotion = user?.pendingPromotion;
    if (!pendingPromotion) return;

    setPromotedLeague(pendingPromotion);
    setShowPromotionModal(true);
  }, [user?.pendingPromotion]);

  // Música del lobby: arranca si no está silenciada; reacciona a Ajustes (mute música / todo).
  useEffect(() => {
    if (audioSettings.masterMute || audioSettings.musicMute) {
      stopLobbyMusic();
    } else {
      playLobbyMusic();
    }
    return () => stopLobbyMusic();
  }, [audioSettings.masterMute, audioSettings.musicMute, playLobbyMusic, stopLobbyMusic]);

  // Si el servidor aún no envió ligas tras conectar (p. ej. reconexión), volver a pedir la config.
  useEffect(() => {
    if (!connected || lobbyServerCategories !== null) return undefined;
    const t = setTimeout(() => requestLobbyConfig(), 400);
    return () => clearTimeout(t);
  }, [connected, lobbyServerCategories, requestLobbyConfig]);

  // Matchmaking sobre el socket global (DominoSocketProvider).
  // No incluir `t`, `navigate`, `updateUser` en deps: suelen cambiar de referencia y el cleanup
  // dispararía leave_queue en bucle, vaciando la cola antes de que el tick empareje.
  const queueCategoryId = view === 'IN_QUEUE' && activeCategory ? activeCategory.categoryId : null;

  useEffect(() => {
    if (!socket || view !== 'IN_QUEUE' || !queueCategoryId) return undefined;

    const categoryId = queueCategoryId;
    const cross = allowCrossLeague;

    const emitJoin = () => {
      socket.emit('join_queue', {
        categoryId,
        allowCrossLeague: cross,
        allowLowerLeague: cross,
      });
    };

    const onGameStart = (payload) => {
      navigateRef.current(`/play/${payload.roomId}`, { state: { fromMatchmaking: true } });
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

    const onQueueError = (payload) => {
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
    socket.on('queue_error', onQueueError);
    socket.on('error', onServerError);
    socket.on('disconnect', onDisconnectWhileQueue);

    return () => {
      socket.off('connect', emitJoin);
      socket.off('game_start', onGameStart);
      socket.off('pr_updated', onPrUpdated);
      socket.off('pr_out_of_range', onPrOutOfRange);
      socket.off('insufficient_balance', onInsufficientBalance);
      socket.off('queue_reset', onQueueReset);
      socket.off('queue_error', onQueueError);
      socket.off('error', onServerError);
      socket.off('disconnect', onDisconnectWhileQueue);
      socket.emit('leave_queue');
    };
  }, [socket, view, queueCategoryId, allowCrossLeague]);

  function handlePlayCategory(cat) {
    setError('');
    if (!token) return;
    const hasCoupon = Number(cat.availableCoupons) > 0;
    if (!hasCoupon && balanceLoading) {
      setError(t('lobby.balanceLoadingShort'));
      return;
    }
    if (!hasCoupon && balanceSubunits === null) {
      setError(
        balanceError
          ? t('lobby.balanceUnavailableShort')
          : t('lobby.balanceLoadingShort'),
      );
      return;
    }
    const fee = Number(cat.entryFee_subunits);
    if (!hasCoupon && Number.isFinite(fee) && fee > 0 && balanceSubunits < fee) {
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

  async function handleClosePromotion() {
    setShowPromotionModal(false);
    try {
      await api.request('POST', '/api/user/clear-promotion');
      updateUser({ pendingPromotion: null });
      setPromotedLeague(null);
    } catch (e) {
      console.warn('[LobbyDomino] No se pudo limpiar pendingPromotion:', e?.message || e);
    }
  }

  return (
    <div className="domino-lobby">

      {/* ── Header con rango y barra PR ─────────────────────────────────── */}
      <RankHeader
        user={user}
        userPR={userPR}
        userRank={effectiveRank}
        balance={balance != null ? Math.floor(Number(balance)) : null}
        categories={categories}
        isSyncing={isSyncingProfile}
        leaguesLoading={lobbyServerCategories === null}
        t={t}
      />

      <InsufficientBalanceModal
        open={insufficientBalanceModal.open}
        serverMessage={insufficientBalanceModal.serverMessage}
        onClose={() => setInsufficientBalanceModal({ open: false, serverMessage: null })}
        onGoToStore={() => {}}
      />

      <CrossLeagueHelpModal
        open={crossLeagueHelpOpen}
        onClose={() => setCrossLeagueHelpOpen(false)}
      />

      {showPromotionModal && promotedLeague && (
        <LeaguePromotionModal
          newLeague={promotedLeague}
          onClose={handleClosePromotion}
        />
      )}

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

            <label className="lobby-allow-lower-league">
              <input
                type="checkbox"
                checked={allowCrossLeague}
                onChange={(e) => setAllowCrossLeague(e.target.checked)}
                className="lobby-allow-lower-league-input"
              />
              <span className="lobby-allow-lower-league-switch" aria-hidden />
              <span className="lobby-allow-lower-league-label">
                {t('lobby.crossLeagueToggle')}
                <button
                  type="button"
                  className="lobby-cross-league-help-btn"
                  aria-label={t('lobby.crossLeagueHelpAria')}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCrossLeagueHelpOpen(true);
                  }}
                >
                  ?
                </button>
              </span>
            </label>

            {lobbyServerCategories === null ? (
              <CategorySkeleton />
            ) : categories.length === 0 ? (
              <div className="domino-lobby-error" style={{ marginTop: 12 }}>
                <p style={{ marginBottom: 12 }}>{t('lobby.leaguesEmpty')}</p>
                <button
                  type="button"
                  className="domino-btn domino-btn-primary"
                  onClick={() => {
                    playButton();
                    requestLobbyConfig();
                  }}
                  disabled={!socket?.connected}
                >
                  {t('lobby.retryLeagues')}
                </button>
              </div>
            ) : (
              <div className="lobby-category-grid">
                {categories.map((cat, i) => {
                  const rankUnlocked = isCategoryUnlocked(effectiveRank, cat.categoryId);
                  const rankMatchReady = rankUnlocked && cat.maxPlayers === 2;
                  const isComingSoon = rankUnlocked && cat.maxPlayers !== 2;
                  const availableCoupons = couponQuantitiesByLeague[cat.categoryId] ?? 0;
                  const hasCoupon = availableCoupons > 0;
                  const displayCat = { ...cat, availableCoupons };
                  let playDisabled = true;
                  let playDisabledReason = null;
                  if (isComingSoon) {
                    playDisabled = true;
                    playDisabledReason = null;
                  } else if (!rankMatchReady) {
                    playDisabled = true;
                    playDisabledReason = null;
                  } else if (!hasCoupon && balanceLoading) {
                    playDisabled = true;
                    playDisabledReason = 'balance_loading';
                  } else if (!hasCoupon && balanceSubunits === null) {
                    playDisabled = true;
                    playDisabledReason = balanceError ? 'balance_unavailable' : 'balance_loading';
                  } else {
                    playDisabled = false;
                  }
                  const isActiveRank = cat.categoryId === effectiveRank;
                  return (
                    <LeagueCard
                      key={cat.categoryId}
                      league={displayCat}
                      availableCoupons={availableCoupons}
                      couponMeta={getLeagueCouponMeta(cat.categoryId)}
                      rankMatchReady={rankMatchReady}
                      playDisabled={playDisabled}
                      playDisabledReason={playDisabledReason}
                      isComingSoon={isComingSoon}
                      index={i}
                      onPlayRequest={handlePlayCategory}
                      onPlayButton={playButton}
                      isActiveRank={isActiveRank}
                    />
                  );
                })}
              </div>
            )}
            <BackHomeButton />
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
