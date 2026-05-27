import { useTranslation } from 'react-i18next';
import { Pencil } from 'lucide-react';
import PlayerAvatar from '../../../components/PlayerAvatar';
import { isVipUser } from '../../../lib/vipUserUi';
import { resolveDisplayName } from '../../../lib/userDisplayName';
import NicknameEditModal from './NicknameEditModal';

export default function ProfileIdentityBlock({
  user,
  previewUser,
  onOpenNicknameModal,
  nicknameModalProps,
}) {
  const { t } = useTranslation();
  const isVip = isVipUser(user);
  const displayName = resolveDisplayName(user, t('userHeader.defaultPlayer'));

  return (
    <section className="flex flex-col items-center pt-4 text-center" aria-label={t('profile.identity.aria')}>
      <div className="scale-110 origin-top">
        <PlayerAvatar
          user={previewUser}
          size="large"
          showName={false}
          showPR={false}
          showNameLabel={false}
          showVipCapsule={isVip}
        />
      </div>

      <div className="mt-4 flex items-center justify-center gap-2">
        <h2
          className={`text-2xl font-bold tracking-tight ${
            isVip ? 'text-amber-200' : 'text-zinc-100'
          }`}
        >
          {displayName}
        </h2>
        <button
          type="button"
          onClick={onOpenNicknameModal}
          className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-amber-200"
          aria-label={t('profile.identity.editNickname')}
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>

      <NicknameEditModal {...nicknameModalProps} />
    </section>
  );
}
