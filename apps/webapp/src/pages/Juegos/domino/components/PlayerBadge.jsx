/**
 * Render tonto de badge: la imagen ya viene resuelta desde el catálogo maestro.
 * @param {{
 *   iconUrl?: string | null,
 *   alt?: string,
 * }} props
 */
export default function PlayerBadge({ iconUrl, alt = 'Insignia' }) {
  if (!iconUrl) return null;

  return (
    <img
      src={iconUrl}
      alt={alt}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        display: 'block',
      }}
      draggable={false}
    />
  );
}
