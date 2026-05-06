import { useMemo, useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import BackHomeButton from '../../components/navigation/BackHomeButton';
import stonesIcon from '../../assets/icono-piedras-2.png';
import styles from './Store.module.css';

const STORE_TABS = [
  { id: 'stones', label: 'Piedras' },
  { id: 'cosmetics', label: 'Cosmeticos' },
];

function formatAmount(value) {
  if (value == null || Number.isNaN(Number(value))) return '0';
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(Number(value));
}

function Store() {
  const { balance } = useAuth();
  const [activeTab, setActiveTab] = useState('stones');
  const [purchasingPackId, setPurchasingPackId] = useState(null);
  const [stonePackages, setStonePackages] = useState([]);
  const [isLoadingPackages, setIsLoadingPackages] = useState(true);
  const currentBalance = useMemo(() => formatAmount(balance), [balance]);

  useEffect(() => {
    async function fetchPackages() {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/config/store`);
        const data = await response.json();
        if (data.ok) {
          setStonePackages(data.storePackages);
        }
      } catch (error) {
        console.error('Error fetching store packages:', error);
      } finally {
        setIsLoadingPackages(false);
      }
    }
    fetchPackages();
  }, []);

  async function handlePurchase(packId) {
    if (purchasingPackId != null) return;
    setPurchasingPackId(packId);
    try {
      // TODO: Integrar Telegram API openInvoice aqui para el siguiente paso del backend.
      await new Promise((resolve) => setTimeout(resolve, 1200));
    } finally {
      setPurchasingPackId(null);
    }
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Store</p>
          <h1 className={styles.title}>Tienda</h1>
        </div>
        <section className={styles.balanceCard} aria-label="Saldo de Piedras">
          <div className={styles.balanceAmount}>{currentBalance}</div>
          <div className={styles.balanceMeta}>
            <img className={styles.balanceIcon} src={stonesIcon} alt="" aria-hidden />
            <span>Piedras disponibles</span>
          </div>
        </section>
      </header>

      <nav className={styles.tabs} aria-label="Categorias de la tienda">
        {STORE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`${styles.tabButton} ${activeTab === tab.id ? styles.tabButtonActive : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className={styles.panel}>
        {activeTab === 'stones' ? (
          <div className={styles.productsGrid}>
            {isLoadingPackages ? (
              <p>Cargando paquetes...</p>
            ) : stonePackages.length === 0 ? (
              <p>No hay paquetes disponibles en este momento.</p>
            ) : (
              stonePackages.map((pack) => {
                const isLoading = purchasingPackId === pack.id;
                return (
                  <article
                    key={pack.id}
                    className={`${styles.productCard} ${pack.isPopular ? styles.productCardPopular : ''}`}
                  >
                    <div className={styles.cardTopRow}>
                      <h3 className={styles.productName}>{pack.name}</h3>
                      {pack.bonusPercent > 0 ? (
                        <span className={styles.bonusBadge}>+{pack.bonusPercent}% Extra</span>
                      ) : null}
                    </div>

                    <p className={styles.productStones}>{formatAmount(pack.piedras)}</p>
                    <p className={styles.productCaption}>Piedras</p>

                    <button
                      type="button"
                      className={styles.buyButton}
                      onClick={() => handlePurchase(pack.id)}
                      disabled={isLoading}
                    >
                      {isLoading ? 'Cargando...' : `${pack.stars} ⭐`}
                    </button>
                  </article>
                );
              })
            )}
          </div>
        ) : (
          <section className={styles.emptyState}>
            <h2>Cosmeticos</h2>
            <p>Muy pronto encontraras marcos, avatares y mas personalizaciones premium.</p>
          </section>
        )}
      </div>
      <BackHomeButton />
    </div>
  );
}

export default Store;