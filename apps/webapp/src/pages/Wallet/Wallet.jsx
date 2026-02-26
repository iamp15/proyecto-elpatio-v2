import { useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import styles from './Wallet.module.css';
import WalletBalanceSection from './components/WalletBalanceSection';
import WalletQuickActions from './components/WalletQuickActions';
import WalletActivitySection from './components/WalletActivitySection';

export default function Wallet() {
  const { refreshWallet } = useAuth();

  useEffect(() => {
    refreshWallet();
  }, [refreshWallet]);

  return (
    <div className={styles.root}>
      <section className={`surface-card ${styles.summaryCard}`} aria-label="Resumen de billetera">
        <WalletBalanceSection />
        <WalletQuickActions />
      </section>
      <WalletActivitySection />
    </div>
  );
}
