import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Award, MessageCircle, Gift, Crown } from 'lucide-react';
import { isVipUser } from '../../../lib/vipUserUi';
import { PROFILE_VIP_MOCK } from '../profileMockData';

const BENEFIT_ICONS = {
  award: Award,
  message: MessageCircle,
  gift: Gift,
};

export default function ProfileEliteHubBlock({ user }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isVip = isVipUser(user);

  if (isVip) {
    return (
      <section
        className="overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-600/25 via-amber-950/40 to-zinc-950 p-5 shadow-lg"
        aria-label={t('profile.elite.aria')}
      >
        <div className="flex items-center justify-center gap-2">
          <Crown className="h-5 w-5 text-amber-300" aria-hidden />
          <p className="text-sm font-semibold uppercase tracking-wider text-amber-200/90">
            {t('profile.elite.status')}
          </p>
        </div>

        <p className="mt-2 text-2xl font-bold text-amber-100">
          {t('profile.elite.daysRemaining', { count: PROFILE_VIP_MOCK.daysRemaining })}
        </p>

        <div className="mt-4 flex justify-center gap-6">
          {PROFILE_VIP_MOCK.benefits.map((benefit) => {
            const Icon = BENEFIT_ICONS[benefit.icon] || Award;
            return (
              <div key={benefit.id} className="flex flex-col items-center gap-1.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 ring-1 ring-amber-400/30">
                  <Icon className="h-5 w-5 text-amber-200" aria-hidden />
                </div>
                <span className="max-w-[4.5rem] text-center text-[10px] font-medium leading-tight text-amber-100/80">
                  {t(benefit.labelKey)}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section
      className="rounded-2xl border border-amber-900/40 bg-zinc-900/60 p-5 text-center"
      aria-label={t('profile.elite.upsellAria')}
    >
      <Crown className="mx-auto mb-2 h-8 w-8 text-amber-500/70" aria-hidden />
      <h3 className="text-lg font-bold text-zinc-100">{t('profile.elite.upsellTitle')}</h3>
      <p className="mt-2 text-sm text-zinc-400">{t('profile.elite.upsellDescription')}</p>
      <button
        type="button"
        onClick={() => navigate('/tienda?tab=vip')}
        className="mt-4 w-full rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 px-4 py-2.5 text-sm font-bold text-zinc-950 transition hover:from-amber-500 hover:to-amber-400"
      >
        {t('profile.elite.cta')}
      </button>
    </section>
  );
}

