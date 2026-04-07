import { useTranslation } from 'react-i18next';
import styles from './Tournaments.module.css';

function Tournaments() {
  const { t } = useTranslation();

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{t('tournaments.title')}</h1>
      <p className={styles.subtitle}>{t('tournaments.comingSoon')}</p>
      
      <div className={styles.comingSoonContainer}>
        <div className={styles.comingSoonIcon}>🎯</div>
        <h2 className={styles.comingSoonTitle}>{t('tournaments.underConstruction')}</h2>
        <p className={styles.comingSoonText}>
          {t('tournaments.featuresDescription')}
        </p>
      </div>

      <div className={styles.featuresGrid}>
        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>🏆</div>
          <h3 className={styles.featureTitle}>{t('tournaments.daily')}</h3>
          <p className={styles.featureDescription}>{t('tournaments.dailyDesc')}</p>
        </div>
        
        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>⚡</div>
          <h3 className={styles.featureTitle}>{t('tournaments.weekly')}</h3>
          <p className={styles.featureDescription}>{t('tournaments.weeklyDesc')}</p>
        </div>
        
        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>👑</div>
          <h3 className={styles.featureTitle}>{t('tournaments.monthly')}</h3>
          <p className={styles.featureDescription}>{t('tournaments.monthlyDesc')}</p>
        </div>
        
        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>🎖️</div>
          <h3 className={styles.featureTitle}>{t('tournaments.special')}</h3>
          <p className={styles.featureDescription}>{t('tournaments.specialDesc')}</p>
        </div>
      </div>

      <div className={styles.infoSection}>
        <h3 className={styles.infoTitle}>{t('tournaments.prizesTitle')}</h3>
        <p className={styles.infoText}>{t('tournaments.prizesDescription')}</p>
      </div>
    </div>
  );
}

export default Tournaments;