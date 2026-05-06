import { useState, useEffect, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../../context/AuthContext';
import { useInventory } from '../../context/InventoryContext';
import PlayerAvatar from '../../components/PlayerAvatar';
import BackHomeButton from '../../components/navigation/BackHomeButton';
import PlayerBadge from '../Juegos/domino/components/PlayerBadge';
import { ITEM_CATALOG } from '../../lib/inventory/itemCatalog';
import { Save, Loader } from 'lucide-react';
import '../Juegos/domino/domino.css';
import styles from './Profile.module.css';

const TABS = [
  { id: 'avatars', label: 'Foto' },
  { id: 'frames', label: 'Marco' },
  { id: 'badges', label: 'Badge' },
];

const TAB_TO_SUBTYPE = {
  avatars: 'avatar_photo',
  frames: 'avatar_frame',
  badges: 'profile_badge',
};

export default function Profile() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, updateUser, api } = useContext(AuthContext);
  const {
    inventory,
    inventoryLoading,
    inventoryError,
    handleEquipItem,
  } = useInventory();
  const [activeTab, setActiveTab] = useState('avatars');
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [avatarId, setAvatarId] = useState(user?.avatar_id || 'avatar_default');
  const [frameId, setFrameId] = useState(user?.frame_id || 'frame_bronce');
  const [badgeId, setBadgeId] = useState(user?.badge_id || 'badge_bronce');
  const [saveLoading, setSaveLoading] = useState(false);
  const [nicknameCheckLoading, setNicknameCheckLoading] = useState(false);
  /** null = sin comprobar aún o el texto cambió; 'available' | 'unavailable' tras comprobar */
  const [nicknameAvailability, setNicknameAvailability] = useState(null);
  const [nicknameError, setNicknameError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const cosmeticsBySubType = useMemo(() => {
    const out = {
      avatar_photo: [],
      avatar_frame: [],
      profile_badge: [],
    };

    for (const item of inventory) {
      if (item.category !== 'cosmetic') continue;
      if (!out[item.subType]) continue;
      out[item.subType].push(item);
    }

    return out;
  }, [inventory]);

  const equippedBySubType = useMemo(() => {
    const out = {};
    for (const [subType, itemsByType] of Object.entries(cosmeticsBySubType)) {
      out[subType] = itemsByType.find((item) => item.isEquipped)?.id ?? null;
    }
    return out;
  }, [cosmeticsBySubType]);

  useEffect(() => {
    setAvatarId(equippedBySubType.avatar_photo || user?.avatar_id || 'avatar_default');
    setFrameId(equippedBySubType.avatar_frame || user?.frame_id || 'frame_bronce');
    setBadgeId(equippedBySubType.profile_badge || user?.badge_id || 'badge_bronce');
  }, [
    equippedBySubType.avatar_photo,
    equippedBySubType.avatar_frame,
    equippedBySubType.profile_badge,
    user?.avatar_id,
    user?.frame_id,
    user?.badge_id,
  ]);

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
    if (category === 'avatars') setAvatarId(itemId);
    if (category === 'frames') setFrameId(itemId);
    if (category === 'badges') setBadgeId(itemId);
  };

  const handleSaveChanges = async () => {
    const currentAvatarId = equippedBySubType.avatar_photo || user?.avatar_id;
    const currentFrameId = equippedBySubType.avatar_frame || user?.frame_id;
    const currentBadgeId = equippedBySubType.profile_badge || user?.badge_id;
    const cosmeticChanges = [
      avatarId && avatarId !== currentAvatarId ? avatarId : null,
      frameId && frameId !== currentFrameId ? frameId : null,
      badgeId && badgeId !== currentBadgeId ? badgeId : null,
    ].filter(Boolean);
    const changedCosmetics = cosmeticChanges.length > 0;
    const changedNickname = nickname.trim() !== (user?.nickname || '');

    if (!changedCosmetics && !changedNickname) {
      setSuccessMessage('No hay cambios que guardar');
      return;
    }

    setSaveLoading(true);
    setSuccessMessage('');
    try {
      if (changedCosmetics) {
        for (const itemId of cosmeticChanges) {
          await handleEquipItem(itemId);
        }
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

  const activeSubType = TAB_TO_SUBTYPE[activeTab];
  const items = cosmeticsBySubType[activeSubType] || [];

  return (
    <div className={`domino-lobby ${styles.root}`}>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>{t('profile.title')}</h1>
        <button type="button" className={styles.backpackLink} onClick={() => navigate('/backpack')}>
          Mochila
        </button>
      </div>

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
            {inventoryLoading ? (
              <div className={styles.carouselLoading}>
                <Loader className={styles.spinner} />
              </div>
            ) : inventoryError ? (
              <p className={styles.errorText}>{inventoryError}</p>
            ) : items.length === 0 ? (
              <p className={styles.hintBox}>No tienes cosméticos de este tipo en tu mochila.</p>
            ) : (
              <>

                <div className={styles.itemGrid}>
                  {items.map((item) => {
                    const meta = ITEM_CATALOG[item.id];
                    const iconUrl = item.iconUrl || meta?.iconUrl;
                    const selected =
                      (activeTab === 'avatars' && avatarId === item.id) ||
                      (activeTab === 'frames' && frameId === item.id) ||
                      (activeTab === 'badges' && badgeId === item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleItemSelect(activeTab, item.id)}
                        className={`${styles.itemBtn} ${selected ? styles.itemBtnSelected : ''}`}
                      >
                        {activeTab === 'avatars' && iconUrl && (
                          <img src={iconUrl} alt="" className={styles.avatarThumb} draggable={false} />
                        )}
                        {activeTab === 'frames' && iconUrl && (
                          <img src={iconUrl} alt="" className={styles.frameThumb} draggable={false} />
                        )}
                        {activeTab === 'badges' && (
                          <div className={styles.badgeThumbWrap}>
                            <PlayerBadge
                              iconUrl={iconUrl}
                              alt={item.name}
                            />
                          </div>
                        )}
                        <span className={styles.itemLabel}>{item.name || meta?.name || item.id}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

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
      <BackHomeButton />
    </div>
  );
}