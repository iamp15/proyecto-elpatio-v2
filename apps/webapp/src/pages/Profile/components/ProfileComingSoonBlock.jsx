import { useTranslation } from 'react-i18next';

export default function ProfileComingSoonBlock() {
  const { t } = useTranslation();

  return (
    <section
      className="rounded-2xl border-2 border-dashed border-zinc-800 py-10 text-center"
      aria-label={t('profile.comingSoonAria')}
    >
      <p className="text-sm text-zinc-500">{t('profile.comingSoon')}</p>
    </section>
  );
}
