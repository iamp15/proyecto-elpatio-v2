const { ITEM_CATALOG, User, isUserVip } = require('@el-patio/database');

const SUB_AVATAR_PHOTO = 'avatar_photo';
const SUB_AVATAR_FRAME = 'avatar_frame';
const SUB_PROFILE_BADGE = 'profile_badge';

const CAT_COSMETIC = 'cosmetic';
const CAT_CONSUMABLE = 'consumable';

const SUB_VIP_PASS_1D = 'vip_pass_1d';

const DEFAULT_AVATAR_ID = 'avatar_default';
const DEFAULT_FRAME_ID = 'frame_bronce';
const DEFAULT_BADGE_ID = 'badge_bronce';

function applyDefaultProfileFieldForSubType(user, subType) {
  switch (subType) {
    case SUB_AVATAR_PHOTO:
      user.avatar_id = DEFAULT_AVATAR_ID;
      break;
    case SUB_AVATAR_FRAME:
      user.frame_id = DEFAULT_FRAME_ID;
      break;
    case SUB_PROFILE_BADGE:
      user.badge_id = DEFAULT_BADGE_ID;
      break;
    default:
      break;
  }
}

function applyEquippedProfileFromItem(user, item) {
  switch (item.subType) {
    case SUB_AVATAR_PHOTO:
      user.avatar_id = item.itemId;
      break;
    case SUB_AVATAR_FRAME:
      user.frame_id = item.itemId;
      break;
    case SUB_PROFILE_BADGE:
      user.badge_id = item.itemId;
      break;
    default:
      break;
  }
}

async function getInventory(req, res, next) {
  try {
    const userId = Number(req.user.userId);
    await User.updateOne(
      { _id: userId },
      { $pull: { inventory: { quantity: { $lte: 0 } } } },
    );

    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ inventory: user.inventory || [] });
  } catch (e) {
    next(e);
  }
}

async function postEquip(req, res, next) {
  try {
    const userId = Number(req.user.userId);
    const itemId = String(req.body?.itemId ?? '').trim();
    if (!itemId) {
      return res.status(400).json({ error: 'itemId requerido' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const entry = user.inventory.find((e) => e.itemId === itemId);
    if (!entry) {
      return res.status(404).json({ error: 'Ítem no encontrado' });
    }
    if (entry.category !== CAT_COSMETIC) {
      return res.status(400).json({ error: 'Solo se pueden equipar ítems cosméticos' });
    }
    if (entry.quantity < 1) {
      return res.status(400).json({ error: 'No tienes unidades de este ítem' });
    }

    const catalogItem = ITEM_CATALOG[itemId];
    if (catalogItem?.requirement === 'vip_active' && !isUserVip(user)) {
      return res.status(403).json({ error: 'No tienes el estado necesario para usar este ítem' });
    }

    if (entry.isEquipped) {
      entry.isEquipped = false;
      applyDefaultProfileFieldForSubType(user, entry.subType);
    } else {
      for (const e of user.inventory) {
        if (e.subType === entry.subType) {
          e.isEquipped = false;
        }
      }
      entry.isEquipped = true;
      applyEquippedProfileFromItem(user, entry);
    }

    await user.save();
    res.json({ inventory: user.inventory });
  } catch (e) {
    next(e);
  }
}

async function postActivate(req, res, next) {
  try {
    const userId = Number(req.user.userId);
    const itemId = String(req.body?.itemId ?? '').trim();
    if (!itemId) {
      return res.status(400).json({ error: 'itemId requerido' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const idx = user.inventory.findIndex((e) => e.itemId === itemId);
    if (idx === -1) {
      return res.status(404).json({ error: 'Ítem no encontrado' });
    }

    const entry = user.inventory[idx];
    if (entry.category !== CAT_CONSUMABLE) {
      return res.status(400).json({ error: 'Solo se pueden activar consumibles' });
    }
    if (entry.subType !== SUB_VIP_PASS_1D) {
      return res.status(400).json({ error: 'Este ítem no se activa desde aquí' });
    }
    if (entry.quantity < 1) {
      return res.status(400).json({ error: 'Sin unidades disponibles' });
    }

    entry.quantity -= 1;
    for (let i = user.inventory.length - 1; i >= 0; i -= 1) {
      if (Number(user.inventory[i]?.quantity) <= 0) {
        user.inventory.splice(i, 1);
      }
    }

    // TODO: Aplicar efecto del ítem en el usuario para integrarlo luego con la lógica VIP

    await user.save();
    res.json({ inventory: user.inventory });
  } catch (e) {
    next(e);
  }
}

module.exports = {
  getInventory,
  postEquip,
  postActivate,
};
