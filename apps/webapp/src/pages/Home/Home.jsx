import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { triggerHaptic } from '../../lib/telegram';
import UserHeader from '../Juegos/UserHeader';
import HomeCardIcon from './HomeCardIcon';
import styles from './Home.module.css';

function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleCardClick = (path) => {
    triggerHaptic('light');
    navigate(path);
  };

  const cards = [
    {
      id: 'leagues',
      path: '/ligas',
      title: t('home.cards.leagues'),
      subtitle: t('home.cards.leaguesSubtitle'),
      iconVariant: 'leagues',
    },
    {
      id: 'tournaments',
      path: '/torneos',
      title: t('home.cards.tournaments'),
      subtitle: t('home.cards.tournamentsSubtitle'),
      iconVariant: 'tournaments',
    },
    {
      id: 'store',
      path: '/tienda',
      title: t('home.cards.store'),
      subtitle: t('home.cards.storeSubtitle'),
      iconVariant: 'store',
    },
    {
      id: 'profile',
      path: '/perfil',
      title: t('home.cards.profile'),
      subtitle: t('home.cards.profileSubtitle'),
      iconVariant: 'profile',
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <UserHeader />
        <p className={styles.subtitle}>{t('home.subtitle')}</p>

        <div className={styles.cardsGrid}>
          {cards.map((card) => (
            <button
              key={card.id}
              type="button"
              className={styles.card}
              onClick={() => handleCardClick(card.path)}
              aria-label={card.title}
            >
              <span className={styles.cardIconWrap}>
                <HomeCardIcon variant={card.iconVariant} className={styles.cardIcon} />
              </span>
              <div className={styles.cardContent}>
                <h3 className={styles.cardTitle}>{card.title}</h3>
                <p className={styles.cardSubtitle}>{card.subtitle}</p>
              </div>
              <span className={styles.cardArrow} aria-hidden>
                →
              </span>
            </button>
          ))}
        </div>

        <div className={styles.infoSection}>
          <h2 className={styles.infoTitle}>{t('home.infoTitle')}</h2>
          <p className={styles.infoText}>{t('home.infoText')}</p>
        </div>
      </div>
    </div>
  );
}

export default Home;
