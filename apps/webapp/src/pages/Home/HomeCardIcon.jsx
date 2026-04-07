/**
 * Iconos de tarjeta en Home: solo reciben color vía currentColor desde el CSS del padre.
 */
const svgProps = {
  width: 28,
  height: 28,
  viewBox: '0 0 24 24',
  fill: 'none',
  xmlns: 'http://www.w3.org/2000/svg',
  'aria-hidden': true,
};

export default function HomeCardIcon({ variant, className }) {
  const stroke = (
    <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {variant === 'leagues' && (
        <>
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
          <path d="M4 22h16" />
          <path d="M10 14.66V17c0 .55-.47 1-1 1H7c-.55 0-1-.45-1-1v-2.34" />
          <path d="M14 14.66V17c0 .55-.47 1-1 1h-2c-.55 0-1-.45-1-1v-2.34" />
          <path d="M12 14V3" />
        </>
      )}
      {variant === 'tournaments' && (
        <>
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" />
        </>
      )}
      {variant === 'store' && (
        <>
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
          <path d="M3 6h18" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </>
      )}
      {variant === 'profile' && (
        <>
          <circle cx="12" cy="8" r="5" />
          <path d="M20 21a8 8 0 1 0-16 0" />
        </>
      )}
    </g>
  );

  return (
    <svg {...svgProps} className={className}>
      {stroke}
    </svg>
  );
}
