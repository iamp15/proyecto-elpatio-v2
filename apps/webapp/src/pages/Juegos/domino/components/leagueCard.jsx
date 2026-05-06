import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import iconoPiedras from '../../../../assets/icono-piedras-2.png';
import './leagueCard.css';

function StoneIcon({ size = 16 }) {
  return (
    <img
      src={iconoPiedras}
      alt=""
      width={size}
      height={size}
      className="lobby-card-stone-icon"
      aria-hidden="true"
      draggable="false"
    />
  );
}

function CouponIcon({ iconUrl, fallbackEmoji = '🎟️', size = 28 }) {
  if (!iconUrl) {
    return (
      <span
        aria-hidden="true"
        className="lobby-card-coupon-fallback"
        style={{ width: size, height: size, fontSize: size * 0.76 }}
      >
        {fallbackEmoji}
      </span>
    );
  }

  return (
    <img
      src={iconUrl}
      alt=""
      aria-hidden="true"
      className="lobby-card-coupon-icon"
      style={{ width: size, height: size }}
      draggable="false"
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

export default function LeagueCard({
  league,
  availableCoupons = 0,
  couponMeta = null,
  rankMatchReady,
  playDisabled,
  playDisabledReason,
  isComingSoon,
  index,
  onPlayRequest,
  isActiveRank,
  onPlayButton,
}) {
  const { t } = useTranslation();
  const maxDisplay = league.maxPR === Infinity ? '∞' : league.maxPR;
  const glowColor = `rgba(${league.colorARaw}, 0.45)`;
  const couponCount = Math.max(0, Number(availableCoupons) || 0);
  const hasCoupon = couponCount > 0;

  const cssVars = {
    '--cat-a':     league.colorA,
    '--cat-b':     league.colorB,
    '--cat-a-raw': league.colorARaw,
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
        <span className="lobby-card-emoji">{league.emoji}</span>
        <div className="lobby-card-heading">
          <div className="lobby-card-title">
            {t('ranks.' + (league.categoryId || 'bronce').toLowerCase())}
          </div>
          <div className="lobby-card-pr-range">
            {t('lobby.prLabel')} {league.minPR}–{maxDisplay}
          </div>
        </div>
      </div>

      <div className={`lobby-card-entry-cost ${hasCoupon ? 'lobby-card-entry-cost--coupon' : ''}`}>
        <span className="lobby-card-entry-label">{t('lobby.entry')}</span>
        <div className="lobby-card-entry-primary">
          {hasCoupon ? (
            <CouponIcon iconUrl={couponMeta?.iconUrl} fallbackEmoji={couponMeta?.fallbackEmoji} />
          ) : (
            <StoneIcon size={18} />
          )}
          <span className="lobby-card-entry-amount">{hasCoupon ? 1 : league.entryFee}</span>
          {hasCoupon && (
            <span className="lobby-card-coupon-owned">
              {t('lobby.couponsAvailable', { count: couponCount })}
            </span>
          )}
        </div>
        {hasCoupon && (
          <div className="lobby-card-entry-secondary">
            <StoneIcon size={11} />
            <span>{t('lobby.originalStoneCost', { count: league.entryFee })}</span>
          </div>
        )}
      </div>

      <motion.button
        className={[
          'lobby-card-play-btn',
          hasCoupon && !playDisabled ? 'lobby-card-play-btn--coupon' : '',
        ].filter(Boolean).join(' ')}
        onClick={() => {
          if (playDisabled) return;
          onPlayButton?.();
          onPlayRequest(league);
        }}
        disabled={playDisabled}
        whileTap={!playDisabled ? {
          scale: 0.94,
          boxShadow: `0 0 0 3px ${league.colorA}, 0 0 20px ${league.colorA}55`,
          transition: { duration: 0.1 },
        } : {}}
        aria-label={
          !playDisabled
            ? t('lobby.playCategory', { category: t('ranks.' + (league.categoryId || 'bronce').toLowerCase()) })
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
          ? hasCoupon
            ? t('lobby.useCoupon')
            : t('lobby.play')
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
