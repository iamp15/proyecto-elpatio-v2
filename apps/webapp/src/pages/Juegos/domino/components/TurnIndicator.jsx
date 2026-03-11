import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

/**
 * Indicador de turno para la cabecera del juego.
 * Muestra la información de cada jugador con un pulso de luz neón
 * alrededor del nombre del jugador activo.
 *
 * @param {{
 *   players:             Array<{ userId: number, socketId: string }>,
 *   turn:                number,
 *   myUserId:            number,
 *   opponentTileCounts:  Object.<number, number>,
 *   tileCount:           Object.<number, number>,
 * }} props
 */
export default function TurnIndicator({
  players,
  turn,
  myUserId,
  opponentTileCounts,
}) {
  const { t } = useTranslation();
  const opponents = players.filter((p) => p.userId !== myUserId);

  return (
    <div style={{
      display:        'flex',
      flexDirection:  'row',
      gap:            '10px',
      padding:        '12px 16px 8px',
      justifyContent: 'center',
    }}>
      {opponents.map((player) => {
        const isActive = turn === player.userId;
        const count    = opponentTileCounts?.[player.userId] ?? '?';

        return (
          <motion.div
            key={player.userId}
            animate={isActive ? {
              boxShadow: [
                '0 0 0 0 rgba(0,229,204,0.35)',
                '0 0 0 7px rgba(0,229,204,0)',
                '0 0 0 0 rgba(0,229,204,0.35)',
              ],
            } : { boxShadow: '0 0 0 0 rgba(0,229,204,0)' }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              display:       'flex',
              alignItems:    'center',
              gap:           '8px',
              padding:       '8px 14px',
              borderRadius:  '40px',
              background:    isActive ? 'rgba(0,229,204,0.08)' : 'var(--domino-surface)',
              border:        `1px solid ${isActive ? 'rgba(0,229,204,0.3)' : 'var(--domino-border)'}`,
              transition:    'background 0.3s, border-color 0.3s',
            }}
          >
            {/* Avatar placeholder */}
            <div style={{
              width:           28,
              height:          28,
              borderRadius:    '50%',
              background:      isActive ? 'var(--domino-neon-dim)' : 'var(--domino-surface-2)',
              border:          `1.5px solid ${isActive ? 'var(--domino-neon)' : 'var(--domino-border-2)'}`,
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              fontSize:        '0.75rem',
              color:           isActive ? 'var(--domino-neon)' : 'var(--domino-text-muted)',
              fontWeight:      700,
              flexShrink:      0,
            }}>
              {String(player.userId).slice(-2)}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              {/* Etiqueta de turno */}
              <AnimatePresence>
                {isActive && (
                  <motion.span
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    style={{
                      fontSize:   '0.65rem',
                      fontWeight: 700,
                      color:      'var(--domino-neon)',
                      textShadow: '0 0 8px var(--domino-neon-glow)',
                      lineHeight: 1,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {t('turnIndicator.turn')}
                  </motion.span>
                )}
              </AnimatePresence>

              {/* Conteo de fichas */}
              <span style={{
                fontSize:   '0.8rem',
                fontWeight: 600,
                color:      isActive ? 'var(--domino-text)' : 'var(--domino-text-muted)',
                lineHeight: 1.2,
              }}>
                {count} {count === 1 ? t('turnIndicator.tile') : t('turnIndicator.tiles')}
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
