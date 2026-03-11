import { useTranslation } from 'react-i18next';

export default function Settings() {
  const { t } = useTranslation();
  return (
    <div style={{ padding: 16 }}>
      <h2>{t('settings.title')}</h2>
      <p style={{ color: 'var(--tg-theme-hint-color, rgba(255,255,255,0.6))' }}>
        {t('settings.comingSoon')}
      </p>
    </div>
  );
}
