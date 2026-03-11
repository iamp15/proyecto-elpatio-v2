import { useTranslation } from 'react-i18next';
import styles from './Profile.module.css';

export default function Profile() {
  const { t } = useTranslation();
  return (
    <div className={styles.root}>
      <p>{t('profile.title')}</p>
    </div>
  );
}
