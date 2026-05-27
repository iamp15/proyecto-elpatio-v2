import { useTranslation } from 'react-i18next';
import { Loader } from 'lucide-react';

export default function NicknameEditModal({
  open,
  nickname,
  onNicknameChange,
  onCheckAvailability,
  onSave,
  onClose,
  nicknameCheckLoading,
  nicknameSaveLoading,
  nicknameAvailability,
  nicknameError,
  canSubmitNicknameCheck,
}) {
  const { t } = useTranslation();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nickname-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="nickname-modal-title" className="mb-1 text-lg font-bold text-zinc-100">
          {t('profile.nicknameModal.title')}
        </h2>
        <p className="mb-4 text-sm text-zinc-400">
          {t('profile.nicknameModal.description')}
        </p>

        <input
          type="text"
          value={nickname}
          onChange={onNicknameChange}
          placeholder={t('profile.nicknameModal.placeholder')}
          className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500/60 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          autoComplete="off"
        />

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {nicknameAvailability === null && (
            <button
              type="button"
              onClick={onCheckAvailability}
              disabled={
                nicknameCheckLoading
                || !canSubmitNicknameCheck()
                || !!nicknameError
              }
              className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-200 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {nicknameCheckLoading ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                t('profile.nicknameModal.check')
              )}
            </button>
          )}
          {nicknameAvailability === 'available' && (
            <span className="text-sm font-semibold text-emerald-400" aria-live="polite">
              {t('profile.nicknameModal.available')}
            </span>
          )}
          {nicknameAvailability === 'unavailable' && (
            <span className="text-sm font-semibold text-red-400" aria-live="polite">
              {t('profile.nicknameModal.unavailable')}
            </span>
          )}
        </div>

        {nicknameError && (
          <p className="mt-2 text-sm text-red-400" role="alert">
            {nicknameError}
          </p>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-zinc-600 px-4 py-2.5 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800"
          >
            {t('profile.nicknameModal.cancel')}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={nicknameSaveLoading}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {nicknameSaveLoading ? (
              <Loader className="h-4 w-4 animate-spin" />
            ) : (
              t('profile.nicknameModal.save')
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
