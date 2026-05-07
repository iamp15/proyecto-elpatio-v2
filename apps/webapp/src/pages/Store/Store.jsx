import { useMemo, useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import BackHomeButton from '../../components/navigation/BackHomeButton';
import stonesIcon from '../../assets/icono-piedras-2.png';
import styles from './Store.module.css';

const STORE_TABS = [
  { id: 'stones', label: 'Piedras' },
  { id: 'vip', label: 'VIP' },
  { id: 'cosmetics', label: 'Cosmeticos' },
];

const VIP_PACKAGES = [
  {
    id: 'vip_7',
    name: 'VIP 7 Dias',
    days: 7,
    stars: 50,
    stones: 0,
    items: ['Insignia VIP', 'Frase VIP', 'Emote VIP'],
    isPopular: false,
  },
  {
    id: 'vip_30',
    name: 'VIP 30 Dias',
    days: 30,
    stars: 250,
    stones: 1500,
    items: ['Insignia VIP', 'Frase VIP', 'Emote VIP', '3 Cupones Bronce'],
    isPopular: true,
  },
  {
    id: 'vip_90',
    name: 'VIP 90 Dias',
    days: 90,
    stars: 500,
    stones: 4500,
    items: ['Insignia VIP', 'Frase VIP', 'Emote VIP', '3 Cupones Bronce', '3 Cupones Plata'],
    isPopular: false,
  },
];

function formatAmount(value) {
  if (value == null || Number.isNaN(Number(value))) return '0';
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(Number(value));
}

function Store() {
  const { balance, api, refreshBalance, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState('stones');
  const [purchasingPackId, setPurchasingPackId] = useState(null);
  const [purchaseError, setPurchaseError] = useState(null);
  const [successPurchase, setSuccessPurchase] = useState(null);
  const [stonePackages, setStonePackages] = useState([]);
  const [isLoadingPackages, setIsLoadingPackages] = useState(true);
  const currentBalance = useMemo(() => formatAmount(balance), [balance]);

  useEffect(() => {
    async function fetchPackages() {
      try {
        console.log('[Store] Cargando paquetes de tienda...');
        const response = await fetch(`${import.meta.env.VITE_API_URL}/config/store`);
        const data = await response.json();
        console.log('[Store] Respuesta /config/store:', data);
        if (data.ok) {
          setStonePackages(data.storePackages);
        }
      } catch (error) {
        console.error('[Store] Error cargando paquetes:', error);
      } finally {
        setIsLoadingPackages(false);
      }
    }
    fetchPackages();
  }, []);

  async function handlePurchase(pack) {
    console.log('[Store] Click comprar:', pack);
    if (purchasingPackId != null) {
      console.log('[Store] Compra ignorada: ya hay un paquete en proceso:', purchasingPackId);
      return;
    }
    setPurchaseError(null);
    setPurchasingPackId(pack.id);

    try {
      console.log('[Store] Solicitando invoice:', { packId: pack.id });
      const res = await api.request('POST', '/store/create-invoice', {
        body: { packId: pack.id },
      });
      console.log('[Store] Respuesta /store/create-invoice:', res);

      if (!res?.success || !res.invoiceUrl) {
        console.error('[Store] Respuesta de invoice inválida:', res);
        setPurchaseError('No se pudo obtener la factura. Intenta de nuevo.');
        setPurchasingPackId(null);
        return;
      }

      const tg = window.Telegram?.WebApp;
      console.log('[Store] Telegram WebApp detectado:', {
        hasTelegram: Boolean(window.Telegram),
        hasWebApp: Boolean(tg),
        hasOpenInvoice: typeof tg?.openInvoice === 'function',
      });

      if (tg && typeof tg.openInvoice === 'function') {
        console.log('[Store] Abriendo invoice en Telegram:', res.invoiceUrl);
        tg.openInvoice(res.invoiceUrl, (status) => {
          console.log('[Store] Callback openInvoice status:', status);
          if (status === 'paid') {
            console.log('Pago completado en Telegram');
            setSuccessPurchase({ type: 'stones', pack });
            setTimeout(() => {
              refreshBalance().catch((err) => {
                console.error('[Store] Error refrescando saldo tras compra:', err);
              });
            }, 1500);
          } else if (status === 'cancelled') {
            console.log('El usuario canceló el pago');
          } else if (status === 'failed') {
            console.error('El pago falló');
          } else if (status === 'pending') {
            console.log('Pago pendiente');
          }
          setPurchasingPackId(null);
        });
      } else {
        console.warn('Telegram WebApp no detectado. URL de factura:', res.invoiceUrl);
        window.open(res.invoiceUrl, '_blank');
        setPurchasingPackId(null);
      }
    } catch (err) {
      console.error('[Store] Error iniciando compra:', err);
      const message =
        err?.body?.error || err?.message || 'No se pudo iniciar la compra. Intenta de nuevo.';
      setPurchaseError(typeof message === 'string' ? message : 'No se pudo iniciar la compra.');
      setPurchasingPackId(null);
    }
  }

  async function handleVipPurchase(pack) {
    console.log('[Store] Click comprar VIP:', pack);
    if (purchasingPackId != null) return;

    setPurchaseError(null);
    setPurchasingPackId(pack.id);
    try {
      const res = await api.request('POST', '/store/buy-vip-mock', {
        body: { packId: pack.id },
      });

      if (!res?.success) {
        setPurchaseError('No se pudo completar la compra VIP. Intenta de nuevo.');
        setPurchasingPackId(null);
        return;
      }

      setSuccessPurchase({ type: 'vip', pack, data: res });
      await Promise.all([refreshUser(), refreshBalance()]);
    } catch (err) {
      console.error('[Store] Error comprando VIP mock:', err);
      const message =
        err?.body?.error || err?.message || 'No se pudo completar la compra VIP.';
      setPurchaseError(typeof message === 'string' ? message : 'No se pudo completar la compra VIP.');
    } finally {
      setPurchasingPackId(null);
    }
  }

  function handleCloseSuccessModal() {
    setSuccessPurchase(null);
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
        {purchaseError ? (
          <p className={styles.purchaseError} role="alert">
            {purchaseError}
          </p>
        ) : null}
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
                      onClick={() => handlePurchase(pack)}
                      disabled={isLoading}
                    >
                      {isLoading ? 'Cargando...' : `${pack.stars} ⭐`}
                    </button>
                  </article>
                );
              })
            )}
          </div>
        ) : activeTab === 'vip' ? (
          <div className={styles.productsGrid}>
            {VIP_PACKAGES.map((pack) => {
              const isLoading = purchasingPackId === pack.id;
              return (
                <article
                  key={pack.id}
                  className={`${styles.productCard} ${styles.vipCard} ${pack.isPopular ? styles.productCardPopular : ''}`}
                >
                  <div className={styles.cardTopRow}>
                    <h3 className={styles.productName}>{pack.name}</h3>
                    {pack.isPopular ? <span className={styles.bonusBadge}>Recomendado</span> : null}
                  </div>
                  <p className={styles.vipDays}>{pack.days} Dias</p>
                  <p className={styles.productCaption}>Membresia VIP</p>

                  <ul className={styles.vipBenefits}>
                    {pack.items.map((benefit) => (
                      <li key={`${pack.id}-${benefit}`}>{benefit}</li>
                    ))}
                    {pack.stones > 0 ? <li>+{formatAmount(pack.stones)} Piedras</li> : null}
                  </ul>

                  <button
                    type="button"
                    className={`${styles.buyButton} ${styles.vipBuyButton}`}
                    onClick={() => handleVipPurchase(pack)}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Procesando...' : `${pack.stars} ⭐`}
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <section className={styles.emptyState}>
            <h2>Cosmeticos</h2>
            <p>Muy pronto encontraras marcos, avatares y mas personalizaciones premium.</p>
          </section>
        )}
      </div>
      <BackHomeButton />

      {successPurchase ? (
        <div className={styles.successModalBackdrop} role="dialog" aria-modal="true" aria-labelledby="store-success-title">
          <section className={styles.successModal}>
            <div className={styles.successIconWrap}>
              <img className={styles.successIcon} src={stonesIcon} alt="" aria-hidden />
            </div>
            <h2 id="store-success-title" className={styles.successTitle}>
              ¡Compra Exitosa!
            </h2>
            <p className={styles.successText}>
              {successPurchase.type === 'stones'
                ? `Has recibido ${formatAmount(successPurchase.pack.piedras)} Piedras.`
                : `Tu membresia VIP fue activada hasta ${new Date(
                    successPurchase.data?.vipExpiresAt,
                  ).toLocaleDateString('es-ES')}.`}
            </p>
            <button type="button" className={styles.successButton} onClick={handleCloseSuccessModal}>
              ¡Excelente!
            </button>
          </section>
        </div>
      ) : null}
    </div>
  );
}

export default Store;