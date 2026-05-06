import sharedItemCatalog from '../../../../../packages/database/catalog/itemCatalog.json';

/**
 * Catálogo maestro estático compartido con el backend: una entrada por `itemId`.
 * Las filas de inventario hacen merge de esta metadata con `quantity` e `isEquipped`.
 *
 * @typedef {Object} ItemCatalogEntry
 * @property {string} name
 * @property {string} description
 * @property {string} fallbackEmoji
 * @property {string} [iconUrl] - Ruta pública (`/assets/...`); si falta, la UI usa solo `fallbackEmoji` vía `icon`
 * @property {'consumable'|'cosmetic'} [category]
 * @property {'avatar_photo'|'avatar_frame'|'profile_badge'|'league_coupon'|'vip_pass_1d'|'chat_phrase'|'chat_emote'} [subType]
 * @property {'none'|'vip_active'} [requirement]
 * @property {'league_entry_coupon'|'activatable_consumable'} [consumableKind] - Solo consumibles con reglas de UI
 */

/** @type {Record<string, ItemCatalogEntry>} */
export const ITEM_CATALOG = sharedItemCatalog;
