import { Link } from 'react-router-dom';
import styles from './BackHomeButton.module.css';

export default function BackHomeButton({ className = '' }) {
  return (
    <div className={`${styles.wrap} ${className}`.trim()}>
      <Link to="/" className={styles.button}>
        Volver
      </Link>
    </div>
  );
}
