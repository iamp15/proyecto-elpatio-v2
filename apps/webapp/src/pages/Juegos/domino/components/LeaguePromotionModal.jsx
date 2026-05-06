import { useEffect, useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import { AnimatePresence, motion } from 'framer-motion';
import { ITEM_CATALOG } from '../../../../lib/inventory/itemCatalog';

const LEAGUE_THEME = {
  BRONCE: {
    label: 'BRONCE',
    itemSlug: 'bronce',
    couponSlug: 'bronze',
    glow: '#cd7f32',
    gradient: 'from-orange-500 via-amber-700 to-stone-700',
  },
  PLATA: {
    label: 'PLATA',
    itemSlug: 'plata',
    couponSlug: 'plata',
    glow: '#cbd5e1',
    gradient: 'from-slate-100 via-slate-300 to-slate-500',
  },
  ORO: {
    label: 'ORO',
    itemSlug: 'oro',
    couponSlug: 'oro',
    glow: '#facc15',
    gradient: 'from-yellow-200 via-amber-400 to-yellow-600',
  },
  DIAMANTE: {
    label: 'DIAMANTE',
    itemSlug: 'diamante',
    couponSlug: 'diamante',
    glow: '#67e8f9',
    gradient: 'from-cyan-200 via-sky-400 to-indigo-500',
  },
};

function getLeagueTheme(newLeague) {
  const key = String(newLeague || '').trim().toUpperCase();
  return LEAGUE_THEME[key] ?? {
    label: key || 'NUEVA LIGA',
    itemSlug: key.toLowerCase(),
    couponSlug: key.toLowerCase(),
    glow: '#00e5cc',
    gradient: 'from-teal-200 via-cyan-400 to-sky-500',
  };
}

function buildPromotionRewards(theme) {
  return [
    {
      key: `coupon_${theme.couponSlug}`,
      label: 'x3 Cupones',
    },
    {
      key: `frame_${theme.itemSlug}`,
      label: `Marco ${theme.label}`,
    },
    {
      key: `badge_${theme.itemSlug}`,
      label: 'Insignia',
    },
  ].map((reward) => ({
    ...reward,
    item: ITEM_CATALOG[reward.key] ?? null,
  }));
}

function RewardCard({ reward }) {
  const { item, label } = reward;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      className="flex min-h-[144px] flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.07] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.25)]"
    >
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-black/25 ring-1 ring-white/10">
        {item?.iconUrl ? (
          <img
            src={item.iconUrl}
            alt={item.name}
            className="max-h-16 max-w-16 object-contain drop-shadow-[0_0_18px_rgba(255,255,255,0.35)]"
          />
        ) : (
          <span className="text-4xl" aria-hidden="true">
            {item?.fallbackEmoji ?? '✦'}
          </span>
        )}
      </div>
      <div className="text-center">
        <p className="m-0 text-sm font-black uppercase tracking-wide text-white">{label}</p>
        <p className="m-1 text-xs font-semibold text-white/55">{item?.name ?? reward.key}</p>
      </div>
    </motion.div>
  );
}

/**
 * Modal de ascenso de liga con celebración y recompensas.
 * @param {{ newLeague: string, onClose: () => void }} props
 */
export default function LeaguePromotionModal({ newLeague, onClose }) {
  const [step, setStep] = useState('celebration');
  const theme = useMemo(() => getLeagueTheme(newLeague), [newLeague]);
  const rewards = useMemo(() => buildPromotionRewards(theme), [theme]);
  const medalItem = ITEM_CATALOG[`badge_${theme.itemSlug}`] ?? ITEM_CATALOG[`frame_${theme.itemSlug}`];

  useEffect(() => {
    setStep('celebration');
  }, [newLeague]);

  useEffect(() => {
    if (step !== 'celebration') return undefined;

    const burst = () => {
      confetti({
        particleCount: 70,
        angle: 60,
        spread: 65,
        origin: { x: 0, y: 0.72 },
        colors: [theme.glow, '#ffffff', '#00e5cc'],
      });
      confetti({
        particleCount: 70,
        angle: 120,
        spread: 65,
        origin: { x: 1, y: 0.72 },
        colors: [theme.glow, '#ffffff', '#facc15'],
      });
    };

    burst();
    const intervalId = window.setInterval(burst, 650);
    const stopId = window.setTimeout(() => window.clearInterval(intervalId), 3000);
    const nextStepId = window.setTimeout(() => setStep('rewards'), 4000);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(stopId);
      window.clearTimeout(nextStepId);
    };
  }, [step, theme.glow]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="league-promotion-title"
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black/80 p-5 text-white backdrop-blur-xl"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background: `radial-gradient(circle at 50% 30%, ${theme.glow}33, transparent 38%), radial-gradient(circle at 50% 80%, rgba(0,229,204,0.18), transparent 42%)`,
        }}
      />

      <AnimatePresence mode="wait">
        {step === 'celebration' ? (
          <motion.section
            key="promotion-celebration"
            initial={{ opacity: 0, scale: 0.86, y: 28 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -12 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            className="relative flex w-full max-w-[420px] flex-col items-center rounded-[28px] border border-white/15 bg-slate-950/80 px-6 py-8 text-center shadow-[0_30px_100px_rgba(0,0,0,0.55)]"
          >
            <p className="mb-3 text-xs font-black uppercase tracking-[0.38em] text-white/55">
              Nueva liga desbloqueada
            </p>

            <motion.div
              animate={{ y: [0, -8, 0], scale: [1, 1.04, 1] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              className={`mb-7 flex h-36 w-36 items-center justify-center rounded-full bg-gradient-to-br ${theme.gradient} p-4`}
              style={{
                boxShadow: `0 0 34px ${theme.glow}cc, 0 0 90px ${theme.glow}66`,
              }}
            >
              {medalItem?.iconUrl ? (
                <img
                  src={medalItem.iconUrl}
                  alt={`Medalla ${theme.label}`}
                  className="h-28 w-28 object-contain drop-shadow-[0_12px_26px_rgba(0,0,0,0.45)]"
                />
              ) : (
                <span className="text-6xl" aria-hidden="true">
                  {medalItem?.fallbackEmoji ?? '🏆'}
                </span>
              )}
            </motion.div>

            <h2
              id="league-promotion-title"
              className="m-0 text-4xl font-black leading-tight tracking-tight text-white md:text-5xl"
              style={{ textShadow: `0 0 26px ${theme.glow}` }}
            >
              ¡ASCENDISTE A {theme.label}!
            </h2>

            <p className="mt-4 max-w-sm text-sm font-semibold leading-6 text-white/65">
              Tu progreso acaba de abrir una nueva liga. Hay recompensas esperándote.
            </p>

            <button
              type="button"
              onClick={() => setStep('rewards')}
              className="mt-8 w-full rounded-2xl bg-cyan-400 px-5 py-4 text-sm font-black uppercase tracking-wide text-slate-950 shadow-[0_0_28px_rgba(34,211,238,0.35)] transition hover:scale-[1.02] hover:bg-cyan-300 active:scale-[0.98]"
            >
              Ver Recompensas
            </button>
          </motion.section>
        ) : (
          <motion.section
            key="promotion-rewards"
            initial={{ opacity: 0, scale: 0.9, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', stiffness: 280, damping: 24 }}
            className="relative w-full max-w-[620px] rounded-[28px] border border-white/15 bg-slate-950/85 px-5 py-7 text-center shadow-[0_30px_100px_rgba(0,0,0,0.55)] md:px-7"
          >
            <p className="mb-2 text-xs font-black uppercase tracking-[0.36em] text-cyan-200/75">
              Ascenso a {theme.label}
            </p>
            <h2 id="league-promotion-title" className="m-0 text-3xl font-black tracking-tight md:text-4xl">
              Recompensas de Ascenso
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm font-semibold leading-6 text-white/60">
              Estos cosméticos y cupones ya forman parte de tu botín de liga.
            </p>

            <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {rewards.map((reward) => (
                <RewardCard key={reward.key} reward={reward} />
              ))}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="mt-8 w-full rounded-2xl bg-gradient-to-r from-amber-300 via-yellow-400 to-orange-400 px-5 py-4 text-sm font-black uppercase tracking-wide text-slate-950 shadow-[0_0_32px_rgba(250,204,21,0.35)] transition hover:scale-[1.02] active:scale-[0.98]"
            >
              ¡Reclamar y Equipar!
            </button>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
