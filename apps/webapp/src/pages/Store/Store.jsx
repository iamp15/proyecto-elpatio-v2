import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { isVipUser } from '../../lib/vipUserUi';
import { expandVipPackageItemRewards } from '../../lib/vipPackageRewards';
import BackHomeButton from '../../components/navigation/BackHomeButton';
import StoreVipItemRewardModal from './components/StoreVipItemRewardModal';
import stonesIcon from '../../assets/icono-piedras-2.png';
import styles from './Store.module.css';

const STORE_TABS = [
  { id: 'stones', labelKey: 'store.tabs.stones' },
  { id: 'vip', labelKey: 'store.tabs.vip' },
  { id: 'cosmetics', labelKey: 'store.tabs.cosmetics' },
];

const VIP_PACKAGE_ORDER = ['vip_7', 'vip_30', 'vip_90'];
const POPULAR_VIP_PACKAGE_ID = 'vip_30';

const VIP_BENEFIT_KEYS = {
  badge_vip: 'vipBadge',
  phrase_vip_mock: 'vipPhrase',
  emote_vip_mock: 'vipEmote',
  coupon_bronze_x3: 'bronzeCoupons3',
  coupon_plata_x3: 'silverCoupons3',
};

const VIP_CONDITIONAL_ITEM_IDS = new Set(['phrase_vip_mock', 'emote_vip_mock', 'badge_vip']);

const VIP_ITEM_MODAL_ORDER = {
  phrase_vip_mock: 10,
  emote_vip_mock: 20,
  badge_vip: 30,
  __stones__: 40,
  coupon_bronze: 50,
  coupon_plata: 60,
};

function formatAmount(value, locale = 'es-ES') {
  if (value == null || Number.isNaN(Number(value))) return '0';
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Number(value));
}

function normalizeVipPackages(vipPackages) {
  if (vipPackages == null || typeof vipPackages !== 'object') return [];
  return Object.entries(vipPackages)
    .map(([id, pack]) => ({
      id,
      days: Number(pack?.days || 0),
      stars: Number(pack?.stars || 0),
      stones: Number(pack?.stones || 0),
      items: Array.isArray(pack?.items) ? pack.items : [],
      isPopular: id === POPULAR_VIP_PACKAGE_ID,
    }))
    .filter((pack) => pack.id && pack.days > 0 && pack.stars > 0)
    .sort((a, b) => {
      const aIdx = VIP_PACKAGE_ORDER.indexOf(a.id);
      const bIdx = VIP_PACKAGE_ORDER.indexOf(b.id);
      if (aIdx !== -1 || bIdx !== -1) {
        return (aIdx === -1 ? Number.MAX_SAFE_INTEGER : aIdx)
          - (bIdx === -1 ? Number.MAX_SAFE_INTEGER : bIdx);
      }
      return a.days - b.days;
    });
}

function buildVipRewardQueue(pack, hadActiveSubscriptionBeforePurchase) {
  const expandedPackItems = expandVipPackageItemRewards(pack?.items).filter((entry) => entry?.itemId);
  const queue = expandedPackItems.filter((entry) => {
    if (VIP_CONDITIONAL_ITEM_IDS.has(entry.itemId)) {
      return !hadActiveSubscriptionBeforePurchase;
    }
    return true;
  });

  const addedStones = Math.max(0, Math.trunc(Number(pack?.stones || 0)));
  if (addedStones > 0) {
    queue.push({ itemId: '__stones__', quantity: addedStones });
  }

  return queue.sort((a, b) => {
    const aOrder = VIP_ITEM_MODAL_ORDER[a.itemId] ?? 999;
    const bOrder = VIP_ITEM_MODAL_ORDER[b.itemId] ?? 999;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return String(a.itemId).localeCompare(String(b.itemId));
  });
}

function computeExpectedVipExpiry(vipStatus, packDays) {
  const nowMs = Date.now();
  const currentExpiryMs = new Date(vipStatus?.expiresAt).getTime();
  const baseMs = Number.isFinite(currentExpiryMs) && currentExpiryMs > nowMs
    ? currentExpiryMs
    : nowMs;
  return new Date(baseMs + Number(packDays || 0) * 24 * 60 * 60 * 1000);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const STORE_TAB_IDS = new Set(['stones', 'vip', 'cosmetics']);

function Store() {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const { balance, api, refreshBalance, refreshUser, user } = useAuth();
  const tabFromUrl = searchParams.get('tab');
  const initialTab = STORE_TAB_IDS.has(tabFromUrl) ? tabFromUrl : 'stones';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [purchasingPackId, setPurchasingPackId] = useState(null);
  const [purchaseError, setPurchaseError] = useState(null);
  const [successPurchase, setSuccessPurchase] = useState(null);
  const [vipItemRewardContext, setVipItemRewardContext] = useState(null);
  const [vipConfirmPack, setVipConfirmPack] = useState(null);
  const [stonePackages, setStonePackages] = useState([]);
  const [vipPackages, setVipPackages] = useState([]);
  const [isLoadingPackages, setIsLoadingPackages] = useState(true);
  const currentLocale = i18n.resolvedLanguage || i18n.language || 'es-ES';
  const currentBalance = useMemo(() => formatAmount(balance, currentLocale), [balance, currentLocale]);

  useEffect(() => {
    if (STORE_TAB_IDS.has(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  useEffect(() => {
    async function fetchPackages() {
      try {
        console.log('[Store] Cargando paquetes de tienda...');
        const response = await fetch(`${import.meta.env.VITE_API_URL}/config/store`);
        const data = await response.json();
        console.log('[Store] Respuesta /config/store:', data);
        if (data.ok) {
          setStonePackages(Array.isArray(data.storePackages) ? data.storePackages : []);
          setVipPackages(normalizeVipPackages(data.vipPackages));
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
        setPurchaseError(t('store.errors.invoiceUnavailable'));
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
        err?.body?.error || err?.message || t('store.errors.purchaseStartFailed');
      setPurchaseError(typeof message === 'string' ? message : t('store.errors.purchaseStartGeneric'));
      setPurchasingPackId(null);
    }
  }

  async function executeVipPurchase(pack) {
    if (purchasingPackId != null) return;

    setPurchaseError(null);
    setPurchasingPackId(pack.id);
    const hadActiveSubscriptionBeforePurchase = isVipUser(user);
    try {
      const res = await api.request('POST', '/store/create-vip-invoice', {
        body: { packId: pack.id },
      });

      if (!res?.success || !res.invoiceUrl) {
        setPurchaseError(t('store.errors.vipPurchaseFailedRetry'));
        setPurchasingPackId(null);
        return;
      }

      const tg = window.Telegram?.WebApp;
      if (!tg || typeof tg.openInvoice !== 'function') {
        window.open(res.invoiceUrl, '_blank');
        setPurchasingPackId(null);
        return;
      }

      tg.openInvoice(res.invoiceUrl, async (status) => {
        if (status === 'paid') {
          const purchaseToken = typeof res.purchaseToken === 'string' ? res.purchaseToken : null;
          let vipExpiresAt = computeExpectedVipExpiry(user?.vip_status, pack.days);
          let appliedByWebhook = false;

          if (purchaseToken) {
            for (let attempt = 0; attempt < 8; attempt += 1) {
              try {
                const statusRes = await api.request('POST', '/store/vip-purchase-status', {
                  body: { purchaseToken },
                });
                if (statusRes?.applied) {
                  appliedByWebhook = true;
                  if (statusRes.vipExpiresAt) {
                    vipExpiresAt = new Date(statusRes.vipExpiresAt);
                  }
                  break;
                }
              } catch (pollErr) {
                console.warn('[Store] Error consultando estado VIP:', pollErr);
              }
              await delay(1000);
            }
          }

          if (!appliedByWebhook) {
            setPurchaseError(t('store.errors.vipPurchasePendingSync'));
          }

          const rewardQueue = buildVipRewardQueue(pack, hadActiveSubscriptionBeforePurchase);
          if (rewardQueue.length > 0) {
            setVipItemRewardContext({
              queue: rewardQueue,
              totalCount: rewardQueue.length,
            });
          }

          setSuccessPurchase({
            type: 'vip',
            pack,
            data: { vipExpiresAt },
          });

          Promise.all([refreshUser(), refreshBalance()]).catch((err) => {
            console.error('[Store] Error sincronizando perfil VIP tras pago:', err);
          });
        }
        setPurchasingPackId(null);
      });
    } catch (err) {
      console.error('[Store] Error creando invoice VIP:', err);
      const message =
        err?.body?.error || err?.message || t('store.errors.vipPurchaseFailed');
      setPurchaseError(typeof message === 'string' ? message : t('store.errors.vipPurchaseFailed'));
      setPurchasingPackId(null);
    }
  }

  function handleVipPurchase(pack) {
    console.log('[Store] Click comprar VIP:', pack);
    if (purchasingPackId != null) return;
    setPurchaseError(null);
    setVipConfirmPack(pack);
  }

  function handleCancelVipConfirm() {
    if (purchasingPackId != null) return;
    setVipConfirmPack(null);
  }

  async function handleConfirmVipPurchase() {
    if (!vipConfirmPack) return;
    const pack = vipConfirmPack;
    await executeVipPurchase(pack);
    setVipConfirmPack(null);
  }

  function handleCloseSuccessModal() {
    setSuccessPurchase(null);
  }

  function handleCloseVipItemReward() {
    setVipItemRewardContext((ctx) => {
      if (!ctx) return null;
      const nextQueue = ctx.queue.slice(1);
      if (nextQueue.length === 0) return null;
      return { ...ctx, queue: nextQueue };
    });
  }

  const currentVipItemReward = vipItemRewardContext?.queue[0] ?? null;
  const vipItemRewardIndex = vipItemRewardContext
    ? vipItemRewardContext.totalCount - vipItemRewardContext.queue.length + 1
    : 0;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{t('store.eyebrow')}</p>
          <h1 className={styles.title}>{t('store.title')}</h1>
        </div>
        <section className={styles.balanceCard} aria-label={t('store.balanceAria')}>
          <div className={styles.balanceAmount}>{currentBalance}</div>
          <div className={styles.balanceMeta}>
            <img className={styles.balanceIcon} src={stonesIcon} alt="" aria-hidden />
            <span>{t('store.stonesAvailable')}</span>
          </div>
        </section>
      </header>

      <nav className={styles.tabs} aria-label={t('store.tabsAria')}>
        {STORE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`${styles.tabButton} ${activeTab === tab.id ? styles.tabButtonActive : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {t(tab.labelKey)}
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
              <p>{t('store.loadingPackages')}</p>
            ) : stonePackages.length === 0 ? (
              <p>{t('store.noPackages')}</p>
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
                        <span className={styles.bonusBadge}>
                          {t('store.bonusExtra', { percent: pack.bonusPercent })}
                        </span>
                      ) : null}
                    </div>

                    <p className={styles.productStones}>{formatAmount(pack.piedras, currentLocale)}</p>
                    <p className={styles.productCaption}>{t('store.stones')}</p>

                    <button
                      type="button"
                      className={styles.buyButton}
                      onClick={() => handlePurchase(pack)}
                      disabled={isLoading}
                    >
                      {isLoading ? t('store.loadingButton') : t('store.starsPrice', { stars: pack.stars })}
                    </button>
                  </article>
                );
              })
            )}
          </div>
        ) : activeTab === 'vip' ? (
          <div className={styles.productsGrid}>
            {isLoadingPackages ? (
              <p>{t('store.loadingPackages')}</p>
            ) : vipPackages.length === 0 ? (
              <p>{t('store.noPackages')}</p>
            ) : (
              vipPackages.map((pack) => {
              const isLoading = purchasingPackId === pack.id;
              return (
                <article
                  key={pack.id}
                  className={`${styles.productCard} ${styles.vipCard} ${pack.isPopular ? styles.productCardPopular : ''}`}
                >
                  <div className={styles.cardTopRow}>
                    <h3 className={styles.productName}>{t('store.vipPackageName', { days: pack.days })}</h3>
                    {pack.isPopular ? <span className={styles.bonusBadge}>{t('store.recommended')}</span> : null}
                  </div>
                  <p className={styles.vipDays}>{t('store.vipDays', { count: pack.days })}</p>
                  <p className={styles.productCaption}>{t('store.vipMembership')}</p>

                  <ul className={styles.vipBenefits}>
                    {pack.items.map((itemId) => (
                      <li key={`${pack.id}-${itemId}`}>
                        {t(`store.vipBenefits.${VIP_BENEFIT_KEYS[itemId]}`, { defaultValue: itemId })}
                      </li>
                    ))}
                    {pack.stones > 0 ? (
                      <li>{t('store.vipBenefits.stones', { amount: formatAmount(pack.stones, currentLocale) })}</li>
                    ) : null}
                  </ul>

                  <button
                    type="button"
                    className={`${styles.buyButton} ${styles.vipBuyButton}`}
                    onClick={() => handleVipPurchase(pack)}
                    disabled={isLoading}
                  >
                    {isLoading ? t('store.processingButton') : t('store.starsPrice', { stars: pack.stars })}
                  </button>
                </article>
              );
              })
            )}
          </div>
        ) : (
          <section className={styles.emptyState}>
            <h2>{t('store.cosmeticsTitle')}</h2>
            <p>{t('store.cosmeticsComingSoon')}</p>
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
              {t('store.successTitle')}
            </h2>
            <p className={styles.successText}>
              {successPurchase.type === 'stones'
                ? t('store.successStones', {
                    amount: formatAmount(successPurchase.pack.piedras, currentLocale),
                  })
                : t('store.successVip', {
                    date: new Date(successPurchase.data?.vipExpiresAt).toLocaleDateString(currentLocale),
                  })}
            </p>
            <button type="button" className={styles.successButton} onClick={handleCloseSuccessModal}>
              {t('store.successButton')}
            </button>
          </section>
        </div>
      ) : currentVipItemReward ? (
        <StoreVipItemRewardModal
          reward={currentVipItemReward}
          currentIndex={vipItemRewardIndex}
          totalCount={vipItemRewardContext.totalCount}
          onAccept={handleCloseVipItemReward}
        />
      ) : null}

      {vipConfirmPack ? (
        <div className={styles.successModalBackdrop} role="dialog" aria-modal="true" aria-labelledby="store-vip-confirm-title">
          <section className={styles.successModal}>
            <h2 id="store-vip-confirm-title" className={styles.successTitle}>
              {t('store.vipConfirmTitle')}
            </h2>
            <p className={styles.successText}>
              {t('store.vipConfirmBody', {
                days: vipConfirmPack.days,
                stars: vipConfirmPack.stars,
              })}
            </p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={`${styles.successButton} ${styles.confirmCancelButton}`}
                onClick={handleCancelVipConfirm}
                disabled={purchasingPackId != null}
              >
                {t('store.vipConfirmCancel')}
              </button>
              <button
                type="button"
                className={styles.successButton}
                onClick={handleConfirmVipPurchase}
                disabled={purchasingPackId != null}
              >
                {purchasingPackId != null ? t('store.processingButton') : t('store.vipConfirmAccept')}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

export default Store;