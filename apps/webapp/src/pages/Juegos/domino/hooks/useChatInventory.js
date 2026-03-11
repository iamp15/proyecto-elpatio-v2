import { useMemo } from 'react';

/**
 * Hook que devuelve el inventario de chat rápido (frases y emojis) desbloqueados.
 * Usa claves i18n para las frases; el consumidor debe traducirlas con t(key).
 * En el futuro puede recibir userProfile y filtrar items desbloqueados desde la DB (monetización).
 *
 * @returns {{ texts: string[], emojis: string[] }}
 */
export default function useChatInventory() {
  const inventory = useMemo(() => {
    return {
      texts: [
        'chat.hello',
        'chat.good_game',
        'chat.oops',
        'chat.lets_go',
        'chat.close_one',
        'chat.well_played',
      ],
      emojis: ['😎', '😭', '😡', '😂', '👏'],
    };
  }, []);

  return inventory;
}
