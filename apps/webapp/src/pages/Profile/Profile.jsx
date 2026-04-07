import { useState, useEffect, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../../context/AuthContext';
import PlayerAvatar from '../../components/PlayerAvatar';
import PlayerBadge from '../Juegos/domino/components/PlayerBadge';
import { Lock, Save, Loader } from 'lucide-react';
import '../Juegos/domino/domino.css';
import styles from './Profile.module.css';

// Simulación de catálogo de items (luego vendrá del backend)
const CATALOG = {
  avatars: [
    { id: 'telegram', name: 'Foto de Telegram', unlocked: true },
    { id: 'default', name: 'Iniciales con gradiente', unlocked: true },
    { id: 'vip_gold', name: 'Avatar VIP Dorado', unlocked: false },
    { id: 'halloween', name: 'Avatar de Halloween', unlocked: false },
  ],
  frames: [
    { id: 'rank', name: 'Marco de Liga', unlocked: true },
    { id: 'vip_gold', name: 'Marco VIP Dorado', unlocked: false },
    { id: 'vip_silver', name: 'Marco VIP Plateado', unlocked: false },
    { id: 'diamond_sparkle', name: 'Marco Diamante', unlocked: false },
    { id: 'gold_sparkle', name: 'Marco Oro Brillante', unlocked: false },
    { id: 'halloween_frame', name: 'Marco de Calabaza', unlocked: false },
  ],
  badges: [
    { id: 'default', name: 'Estrella', unlocked: true },
    { id: 'vip', name: 'Corona› VIP', unlocked: false },
    { id: 'torneo', name: 'Rayo› de Torneo', unlocked: false },
    { id: 'fundador', name: 'Escudo› de Fundador', unlocked: false },
    { id: 'winner', name: 'Trofeo› de Ganador', unlocked: false },
    { id: 'streak', name: 'Llama› de Racha', unlocked: false },
  ],
};

// Mapa de variantes de badge para IDs del catálogo
const BADGE_VARIANT_MAP = {
  default: 'default',
  vip: 'vip',
  torneo: 'torneo',
  fundador: 'fundador',
  winner: 'default',
  streak: 'default',
};

const TABS = [
  { id: 'avatars', label: 'Foto' },
  { id: 'frames', label: 'Marco' },
  { id: 'badges', label: 'Badge' },
];

export default function Profile() {
  const { t } = useTranslation();
  const { user, updateUser, updateCosmetics, api } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('avatars');
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [avatarId, setAvatarId] = useState(user?.avatar_id || 'telegram');
  const [frameId, setFrameId] = useState(user?.frame_id || 'rank');
  const [badgeId, setBadgeId] = useState(user?.badge_id || 'default');
  const [catalog, setCatalog] = useState(CATALOG);
  const [unlockedItems, setUnlockedItems] = useState({ avatars: [], frames: [], badges: [] });
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [nicknameCheckLoading, setNicknameCheckLoading] = useState(false);
  /** null = sin comprobar aún o el texto cambió; 'available' | 'unavailable' tras comprobar */
  const [nicknameAvailability, setNicknameAvailability] = useState(null);
  const [nicknameError, setNicknameError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Cargar catálogo real y items desbloqueados desde backend
  useEffect(() => {
    const fetchCosmetics = async () => {
      if (!api) return;
      setLoading(true);
      try {
        const data = await api.request('GET', '/auth/profile/cosmetics');
        setUnlockedItems(data.unlocked);
        setAvatarId(data.selected.avatar_id);
        setFrameId(data.selected.frame_id);
        setBadgeId(data.selected.badge_id);
      } catch (err) {
        console.warn('No se pudo cargar catálogo de cosméticos:', err);
        // Mantener catálogo simulado
      } finally {
        setLoading(false);
      }
    };
    fetchCosmetics();
  }, [api]);

  // Determinar qué items están desbloqueados según la respuesta del backend
  const isItemUnlocked = (category, itemId) => {
    if (category === 'avatars') return unlockedItems.avatars.includes(itemId);
    if (category === 'frames') return unlockedItems.frames.includes(itemId);
    if (category === 'badges') return unlockedItems.badges.includes(itemId);
    return false;
  };

  // Construir objeto user para PlayerAvatar
  const previewUser = {
    ...user,
    avatar_id: avatarId,
    frame_id: frameId,
    badge_id: badgeId,
  };

  // Validar nickname en tiempo real
  const validateNickname = (value) => {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      setNicknameError('');
      return false;
    }
    if (!/^[a-zA-Z0-9]{3,12}$/.test(trimmed)) {
      setNicknameError('El nickname debe tener entre 3 y 12 letras/números');
      return false;
    }
    setNicknameError('');
    return true;
  };

  const handleNicknameChange = (e) => {
    const value = e.target.value;
    setNickname(value);
    setNicknameAvailability(null);
    validateNickname(value);
  };

  const canSubmitNicknameCheck = () => {
    const trimmed = nickname.trim();
    if (trimmed.length === 0) return false;
    return /^[a-zA-Z0-9]{3,12}$/.test(trimmed);
  };

  const checkNicknameAvailability = async () => {
    if (!validateNickname(nickname)) return;
    if (!canSubmitNicknameCheck()) return;

    setNicknameCheckLoading(true);
    setNicknameError('');
    setSuccessMessage('');
    try {
      const data = await api.request('POST', '/auth/nickname/check', {
        body: { nickname: nickname.trim() },
      });
      setNicknameAvailability(data?.available === true ? 'available' : 'unavailable');
    } catch (err) {
      setNicknameAvailability(null);
      if (err.body?.error) {
        setNicknameError(err.body.error);
      } else {
        setNicknameError('Error al comprobar disponibilidad');
      }
    } finally {
      setNicknameCheckLoading(false);
    }
  };

  const handleItemSelect = (category, itemId) => {
    if (!isItemUnlocked(category, itemId)) return;
    if (category === 'avatars') setAvatarId(itemId);
    if (category === 'frames') setFrameId(itemId);
    if (category === 'badges') setBadgeId(itemId);
  };

  const handleSaveChanges = async () => {
    const changedCosmetics =
      avatarId !== user?.avatar_id ||
      frameId !== user?.frame_id ||
      badgeId !== user?.badge_id;
    const changedNickname = nickname.trim() !== (user?.nickname || '');

    if (!changedCosmetics && !changedNickname) {
      setSuccessMessage('No hay cambios que guardar');
      return;
    }

    setSaveLoading(true);
    setSuccessMessage('');
    try {
      // Actualizar cosméticos
      if (changedCosmetics) {
        await updateCosmetics(
          avatarId,
          frameId,
          badgeId,
        );
      }
      if (changedNickname) {
        const data = await api.request('PATCH', '/auth/nickname', {
          body: { nickname: nickname.trim() },
        });
        if (data?.user) {
          updateUser({ nickname: data.user.nickname ?? nickname.trim() });
        } else {
          updateUser({ nickname: nickname.trim() });
        }
        setNicknameAvailability(null);
      }
      setSuccessMessage('Cambios guardados exitosamente');
    } catch (err) {
      if (err.body?.error) {
        setNicknameError(err.body.error);
      } else {
        setNicknameError('Error al guardar cambios');
      }
    } finally {
      setSaveLoading(false);
    }
  };

  // Filtrar badges
  const items = activeTab === 'badges'
    ? catalog.badges
    : catalog[activeTab] || [];

  return (
    <div className={`domino-lobby ${styles.root}`}>
      <h1 className={styles.title}>{t('profile.title')}</h1>

      <div className={styles.grid}>
        {/* --- Columna izquierda: Vista previa --- */}
        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>Vista Previa</h2>
          <div className={styles.previewOuter}>
            <div className={styles.previewScale}>
              <PlayerAvatar
                user={previewUser}
                size="large"
                showName={false}
                showPR={false}
                showNameLabel
              />
            </div>
          </div>
          <div className={styles.previewCaption}>
            <p>Tu identidad se verá así en partidas y perfiles.</p>
            <p className={styles.previewMeta}>
              Avatar: {avatarId} | Marco: {frameId} | Badge: {badgeId}
            </p>
          </div>
        </div>

        {/* --- Columna derecha: Selectores --- */}
        <div className={styles.column}>
          {/* Tabs de categoría */}
          <div className={styles.tabsRow}>
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Carrusel de items */}
          <div className={styles.carousel}>
            {loading ? (
              <div className={styles.carouselLoading}>
                <Loader className={styles.spinner} />
              </div>
            ) : (
              <>

                <div className={styles.itemGrid}>
                  {items.map((item) => {
                    const unlocked = isItemUnlocked(activeTab, item.id);
                    const selected =
                      (activeTab === 'avatars' && avatarId === item.id) ||
                      (activeTab === 'frames' && frameId === item.id) ||
                      (activeTab === 'badges' && badgeId === item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleItemSelect(activeTab, item.id)}
                        disabled={!unlocked}
                        className={`${styles.itemBtn} ${selected ? styles.itemBtnSelected : ''} ${!unlocked ? styles.itemBtnLocked : ''}`}
                      >
                        {!unlocked && (
                          <div className={styles.lockIcon}>
                            <Lock size={14} />
                          </div>
                        )}
                        {activeTab === 'avatars' && <div className={styles.avatarThumb} />}
                        {activeTab === 'frames' && <div className={styles.frameThumb} />}
                        {activeTab === 'badges' && (
                          <div className={styles.badgeThumbWrap}>
                            <PlayerBadge
                              variant={BADGE_VARIANT_MAP[item.id] || 'default'}
                              color={user?.rank || 'gray'}
                            />
                          </div>
                        )}
                        <span className={styles.itemLabel}>{item.name}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {items.some((item) => !isItemUnlocked(activeTab, item.id)) && (
            <div className={styles.hintBox}>
              <p>
                <Lock size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                Los items bloqueados se desbloquean alcanzando rangos, siendo VIP o completando logros.
              </p>
            </div>
          )}

          <div className={styles.panel}>
            <h3 className={styles.panelTitle}>Nickname</h3>
            <p className={styles.nicknameDesc}>
              Elige un nombre único que te identifique (3‑12 letras/números, sin espacios).
            </p>
            <div className={styles.inputRow}>
              <input
                type="text"
                value={nickname}
                onChange={handleNicknameChange}
                placeholder="Ej: Pablito123"
                className={styles.input}
                autoComplete="off"
              />
              {nicknameAvailability === null && (
                <button
                  type="button"
                  onClick={checkNicknameAvailability}
                  disabled={
                    nicknameCheckLoading
                    || !canSubmitNicknameCheck()
                    || !!nicknameError
                  }
                  className={styles.btnNeon}
                >
                  {nicknameCheckLoading ? (
                    <Loader className={styles.spinnerSmall} />
                  ) : (
                    'Comprobar'
                  )}
                </button>
              )}
              {nicknameAvailability === 'available' && (
                <span className={styles.nicknameAvailOk} aria-live="polite">
                  ✓ disponible
                </span>
              )}
              {nicknameAvailability === 'unavailable' && (
                <span className={styles.nicknameAvailBad} aria-live="polite">
                  ✗ no disponible
                </span>
              )}
            </div>
            {nicknameError && (
              <p className={styles.errorText}>{nicknameError}</p>
            )}
            {successMessage && (
              <p className={styles.successText}>{successMessage}</p>
            )}
          </div>

          <div className={styles.saveRow}>
            <button
              type="button"
              onClick={handleSaveChanges}
              disabled={saveLoading}
              className={styles.btnSave}
            >
              {saveLoading ? (
                <Loader className={styles.spinner} />
              ) : (
                <Save size={20} />
              )}
              Guardar Cambios
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}