import { useTranslation } from 'react-i18next';
import { Check, Loader, Save } from 'lucide-react';
import PlayerBadge from '../../Juegos/domino/components/PlayerBadge';
import { ITEM_CATALOG } from '../../../lib/inventory/itemCatalog';
import { PROFILE_TABS } from '../profileConstants';

export default function ProfileCustomizerBlock({
  activeTab,
  setActiveTab,
  items,
  inventoryLoading,
  inventoryError,
  isItemSelected,
  onItemSelect,
  onSave,
  saveLoading,
  cosmeticSuccessMessage,
  cosmeticError,
}) {
  const { t } = useTranslation();

  return (
    <section
      className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4"
      aria-label={t('profile.customizer.aria')}
    >
      <h3 className="mb-3 text-lg font-bold text-zinc-100">
        {t('profile.customizer.title')}
      </h3>

      <nav
        className="mb-4 inline-flex w-full gap-1 rounded-full border border-zinc-800 bg-zinc-950 p-1"
        aria-label={t('profile.customizer.tabsAria')}
      >
        {PROFILE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 rounded-full px-2 py-1.5 text-xs font-semibold transition sm:text-sm ${
              activeTab === tab.id
                ? 'bg-amber-600/90 text-zinc-950'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </nav>

      <div className="min-h-[12rem] rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
        {inventoryLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader className="h-8 w-8 animate-spin text-amber-400" />
          </div>
        ) : inventoryError ? (
          <p className="text-center text-sm text-red-400" role="alert">
            {inventoryError}
          </p>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">
            {t('profile.customizer.empty')}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {items.map((item) => {
              const meta = ITEM_CATALOG[item.id];
              const iconUrl = item.iconUrl || meta?.iconUrl;
              const selected = isItemSelected(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onItemSelect(activeTab, item.id)}
                  aria-pressed={selected}
                  className={`relative flex aspect-square flex-col items-center justify-center rounded-xl border bg-zinc-800/50 p-2 transition ${
                    selected
                      ? 'border-emerald-400 ring-2 ring-emerald-400/80'
                      : 'border-zinc-700 hover:border-zinc-500'
                  }`}
                >
                  {selected && (
                    <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-zinc-950">
                      <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                    </span>
                  )}
                  {activeTab === 'avatars' && iconUrl && (
                    <img
                      src={iconUrl}
                      alt=""
                      className="h-10 w-10 rounded-full object-contain"
                      draggable={false}
                    />
                  )}
                  {activeTab === 'frames' && iconUrl && (
                    <img
                      src={iconUrl}
                      alt=""
                      className="h-10 w-10 object-contain"
                      draggable={false}
                    />
                  )}
                  {activeTab === 'badges' && (
                    <div className="flex h-6 w-full items-center justify-center">
                      <PlayerBadge iconUrl={iconUrl} alt={item.name} />
                    </div>
                  )}
                  <span className="mt-1 w-full truncate text-center text-[10px] text-zinc-400">
                    {item.name || meta?.name || item.id}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {cosmeticError && (
        <p className="mt-2 text-sm text-red-400" role="alert">
          {cosmeticError}
        </p>
      )}
      {cosmeticSuccessMessage && (
        <p className="mt-2 text-sm text-emerald-400" aria-live="polite">
          {cosmeticSuccessMessage}
        </p>
      )}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onSave}
          disabled={saveLoading}
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-5 py-2.5 text-sm font-bold text-emerald-400 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saveLoading ? (
            <Loader className="h-5 w-5 animate-spin" />
          ) : (
            <Save className="h-5 w-5" />
          )}
          {t('profile.customizer.save')}
        </button>
      </div>
    </section>
  );
}
