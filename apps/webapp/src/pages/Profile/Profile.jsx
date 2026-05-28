import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import BackHomeButton from '../../components/navigation/BackHomeButton';
import ProfileIdentityBlock from './components/ProfileIdentityBlock';
import ProfileEliteHubBlock from './components/ProfileEliteHubBlock';
import ProfileCustomizerBlock from './components/ProfileCustomizerBlock';
import ProfileComingSoonBlock from './components/ProfileComingSoonBlock';
import { useProfileDashboard } from './hooks/useProfileDashboard';
import '../Juegos/domino/domino.css';

export default function Profile() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dashboard = useProfileDashboard();

  const nicknameModalProps = {
    open: dashboard.nicknameModalOpen,
    nickname: dashboard.nickname,
    onNicknameChange: dashboard.handleNicknameChange,
    onCheckAvailability: dashboard.checkNicknameAvailability,
    onSave: dashboard.handleSaveNickname,
    onClose: dashboard.closeNicknameModal,
    nicknameCheckLoading: dashboard.nicknameCheckLoading,
    nicknameSaveLoading: dashboard.nicknameSaveLoading,
    nicknameAvailability: dashboard.nicknameAvailability,
    nicknameError: dashboard.nicknameError,
    canSubmitNicknameCheck: dashboard.canSubmitNicknameCheck,
  };

  return (
    <div className="min-h-full bg-[#0a0b0e] text-zinc-100">
      <div className="mx-auto max-w-lg space-y-6 px-4 pb-24 pt-4">
        <header className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold tracking-wide text-zinc-100">
            {t('profile.title')}
          </h1>
          <button
            type="button"
            onClick={() => navigate('/backpack')}
            className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/20"
          >
            {t('profile.backpack')}
          </button>
        </header>

        <ProfileIdentityBlock
          user={dashboard.user}
          previewUser={dashboard.previewUser}
          onOpenNicknameModal={dashboard.openNicknameModal}
          nicknameModalProps={nicknameModalProps}
        />

        <ProfileEliteHubBlock user={dashboard.user} inventory={dashboard.inventory} />

        <ProfileCustomizerBlock
          activeTab={dashboard.activeTab}
          setActiveTab={dashboard.setActiveTab}
          items={dashboard.items}
          inventoryLoading={dashboard.inventoryLoading}
          inventoryError={dashboard.inventoryError}
          isItemSelected={dashboard.isItemSelected}
          onItemSelect={dashboard.handleItemSelect}
          onSave={dashboard.handleSaveCosmetics}
          saveLoading={dashboard.saveLoading}
          cosmeticSuccessMessage={dashboard.cosmeticSuccessMessage}
          cosmeticError={dashboard.cosmeticError}
        />

        <ProfileComingSoonBlock />
      </div>

      <BackHomeButton />
    </div>
  );
}
