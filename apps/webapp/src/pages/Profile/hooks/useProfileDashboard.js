import { useState, useEffect, useContext, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../../../context/AuthContext';
import { useInventory } from '../../../context/InventoryContext';
import { TAB_TO_SUBTYPE } from '../profileConstants';

export function useProfileDashboard() {
  const { t } = useTranslation();
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
  const [nicknameSaveLoading, setNicknameSaveLoading] = useState(false);
  const [nicknameCheckLoading, setNicknameCheckLoading] = useState(false);
  const [nicknameAvailability, setNicknameAvailability] = useState(null);
  const [nicknameError, setNicknameError] = useState('');
  const [cosmeticSuccessMessage, setCosmeticSuccessMessage] = useState('');
  const [cosmeticError, setCosmeticError] = useState('');
  const [nicknameModalOpen, setNicknameModalOpen] = useState(false);

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
    setNickname(user?.nickname || '');
  }, [user?.nickname]);

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

  const previewUser = useMemo(
    () => ({
      ...user,
      avatar_id: avatarId,
      frame_id: frameId,
      badge_id: badgeId,
    }),
    [user, avatarId, frameId, badgeId],
  );

  const activeSubType = TAB_TO_SUBTYPE[activeTab];
  const items = cosmeticsBySubType[activeSubType] || [];

  const validateNickname = useCallback(
    (value) => {
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        setNicknameError('');
        return false;
      }
      if (!/^[a-zA-Z0-9]{3,12}$/.test(trimmed)) {
        setNicknameError(t('profile.nicknameModal.validationError'));
        return false;
      }
      setNicknameError('');
      return true;
    },
    [t],
  );

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
        setNicknameError(t('profile.nicknameModal.checkError'));
      }
    } finally {
      setNicknameCheckLoading(false);
    }
  };

  const openNicknameModal = () => {
    setNickname(user?.nickname || '');
    setNicknameAvailability(null);
    setNicknameError('');
    setNicknameModalOpen(true);
  };

  const closeNicknameModal = () => {
    setNicknameModalOpen(false);
    setNickname(user?.nickname || '');
    setNicknameAvailability(null);
    setNicknameError('');
  };

  const handleItemSelect = (category, itemId) => {
    if (category === 'avatars') setAvatarId(itemId);
    if (category === 'frames') setFrameId(itemId);
    if (category === 'badges') setBadgeId(itemId);
    setCosmeticSuccessMessage('');
    setCosmeticError('');
  };

  const isItemSelected = (itemId) => {
    if (activeTab === 'avatars') return avatarId === itemId;
    if (activeTab === 'frames') return frameId === itemId;
    if (activeTab === 'badges') return badgeId === itemId;
    return false;
  };

  const handleSaveCosmetics = async () => {
    const currentAvatarId = equippedBySubType.avatar_photo || user?.avatar_id;
    const currentFrameId = equippedBySubType.avatar_frame || user?.frame_id;
    const currentBadgeId = equippedBySubType.profile_badge || user?.badge_id;
    const cosmeticChanges = [
      avatarId && avatarId !== currentAvatarId ? avatarId : null,
      frameId && frameId !== currentFrameId ? frameId : null,
      badgeId && badgeId !== currentBadgeId ? badgeId : null,
    ].filter(Boolean);

    if (cosmeticChanges.length === 0) {
      setCosmeticSuccessMessage(t('profile.customizer.noChanges'));
      return;
    }

    setSaveLoading(true);
    setCosmeticSuccessMessage('');
    setCosmeticError('');
    try {
      for (const itemId of cosmeticChanges) {
        await handleEquipItem(itemId);
      }
      setCosmeticSuccessMessage(t('profile.customizer.saveSuccess'));
    } catch (err) {
      if (err.body?.error) {
        setCosmeticError(err.body.error);
      } else {
        setCosmeticError(t('profile.customizer.saveError'));
      }
    } finally {
      setSaveLoading(false);
    }
  };

  const handleSaveNickname = async () => {
    const trimmed = nickname.trim();
    const unchanged = trimmed === (user?.nickname || '');

    if (unchanged) {
      closeNicknameModal();
      return;
    }

    if (!validateNickname(nickname)) return;

    if (nicknameAvailability === 'unavailable') {
      setNicknameError(t('profile.nicknameModal.unavailableError'));
      return;
    }

    setNicknameSaveLoading(true);
    setNicknameError('');
    try {
      const data = await api.request('PATCH', '/auth/nickname', {
        body: { nickname: trimmed },
      });
      if (data?.user) {
        updateUser({ nickname: data.user.nickname ?? trimmed });
      } else {
        updateUser({ nickname: trimmed });
      }
      setNicknameAvailability(null);
      closeNicknameModal();
    } catch (err) {
      if (err.body?.error) {
        setNicknameError(err.body.error);
      } else {
        setNicknameError(t('profile.nicknameModal.saveError'));
      }
    } finally {
      setNicknameSaveLoading(false);
    }
  };

  return {
    user,
    inventory,
    previewUser,
    activeTab,
    setActiveTab,
    items,
    inventoryLoading,
    inventoryError,
    nickname,
    nicknameModalOpen,
    openNicknameModal,
    closeNicknameModal,
    handleNicknameChange,
    checkNicknameAvailability,
    handleSaveNickname,
    handleSaveCosmetics,
    handleItemSelect,
    isItemSelected,
    saveLoading,
    nicknameSaveLoading,
    nicknameCheckLoading,
    nicknameAvailability,
    nicknameError,
    cosmeticSuccessMessage,
    cosmeticError,
    canSubmitNicknameCheck,
  };
}
