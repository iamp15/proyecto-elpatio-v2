import { useTranslation } from 'react-i18next';
import styles from './Store.module.css';

function Store() {
  const { t } = useTranslation();

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{t('store.title')}</h1>
      <p className={styles.subtitle}>{t('store.comingSoon')}</p>
      
      <div className={styles.comingSoonContainer}>
        <div className={styles.comingSoonIcon}>🛍️</div>
        <h2 className={styles.comingSoonTitle}>{t('store.underConstruction')}</h2>
        <p className={styles.comingSoonText}>
          {t('store.featuresDescription')}
        </p>
      </div>

      <div className={styles.featuresGrid}>
        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>🎨</div>
          <h3 className={styles.featureTitle}>{t('store.avatars')}</h3>
          <p className={styles.featureDescription}>{t('store.avatarsDesc')}</p>
        </div>
        
        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>🖼️</div>
          <h3 className={styles.featureTitle}>{t('store.frames')}</h3>
          <p className={styles.featureDescription}>{t('store.framesDesc')}</p>
        </div>
        
        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>🏅</div>
          <h3 className={styles.featureTitle}>{t('store.badges')}</h3>
          <p className={styles.featureDescription}>{t('store.badgesDesc')}</p>
        </div>
        
        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>🎵</div>
          <h3 className={styles.featureTitle}>{t('store.sounds')}</h3>
          <p className={styles.featureDescription}>{t('store.soundsDesc')}</p>
        </div>
      </div>
    </div>
  );
}

export default Store;