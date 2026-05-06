/**
 * Mapeo de inventario servidor → UI. La metadata estática vive en `itemCatalog.js` (ITEM_CATALOG).
 */

import { ITEM_CATALOG } from './itemCatalog';

/** @typedef {'consumable' | 'cosmetic'} InventoryCategory */

/**
 * @typedef {Object} InventoryUiItem
 * @property {string} id
 * @property {InventoryCategory} category
 * @property {string} subType
 * @property {string} name
 * @property {string} description
 * @property {number} [quantity]
 * @property {boolean} [isEquipped]
 * @property {string} icon - Emoji de respaldo (desde `fallbackEmoji` del catálogo)
 * @property {string} [iconUrl] - Imagen del catálogo, si existe
 * @property {'none'|'vip_active'} [requirement]
 */

/**
 * @param {object} row - Fila cruda del API (`itemId`, `category`, `subType`, …)
 * @returns {InventoryUiItem}
 */
function mapOneInventoryRow(row) {
  const staticMeta = ITEM_CATALOG[row.itemId];
  const category = (row.category ?? staticMeta?.category) === 'cosmetic' ? 'cosmetic' : 'consumable';
  const baseDynamic = {
    id: row.itemId,
    category,
    subType: row.subType ?? staticMeta?.subType,
    quantity: typeof row.quantity === 'number' ? row.quantity : undefined,
    isEquipped: Boolean(row.isEquipped),
  };

  if (!staticMeta) {
    return {
      ...baseDynamic,
      name: typeof row.itemId === 'string' && row.itemId.length ? row.itemId : 'Ítem',
      description: '',
      icon: '📦',
    };
  }

  const out = {
    ...baseDynamic,
    name: staticMeta.name,
    description: staticMeta.description,
    icon: staticMeta.fallbackEmoji,
    requirement: staticMeta.requirement ?? 'none',
  };
  if (staticMeta.iconUrl) {
    out.iconUrl = staticMeta.iconUrl;
  }
  return out;
}

/**
 * @param {object[]} rows
 * @returns {InventoryUiItem[]}
 */
export function mapServerInventoryToUi(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map(mapOneInventoryRow);
}

export function isPassiveLeagueCouponItem(item) {
  if (item.category !== 'consumable') return false;
  return ITEM_CATALOG[item.id]?.consumableKind === 'league_entry_coupon';
}

export function isActiveConsumableItem(item) {
  return (
    item.category === 'consumable' &&
    ITEM_CATALOG[item.id]?.consumableKind === 'activatable_consumable'
  );
}

export const PASSIVE_LEAGUE_COUPON_HINT =
  'Este pase se utiliza automáticamente al ingresar a la Liga correspondiente.';
