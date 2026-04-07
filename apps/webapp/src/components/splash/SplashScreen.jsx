import { useCallback, useEffect, useRef, useState } from 'react';
import { SPLASH_BG_PUBLIC_URL } from './splashConstants.js';

/**
 * Pantalla de arranque alineada con `#splash-critical` e imagen en `public/assets/splash_bg.png`.
 * La barra de progreso solo aparece tras `onLoad` de la imagen (misma URL que el CSS crítico).
 *
 * @param {{ progress: number, onVisualReady?: () => void }} props
 */
export default function SplashScreen({ progress, onVisualReady }) {
  const safePct = Math.min(100, Math.max(0, Number.isFinite(progress) ? progress : 0));
  const pctLabel = `${Math.round(safePct)}%`;
  const [imageReady, setImageReady] = useState(false);
  const readyNotifiedRef = useRef(false);

  const notifyVisualReady = useCallback(() => {
    if (readyNotifiedRef.current) return;
    readyNotifiedRef.current = true;
    setImageReady(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        onVisualReady?.();
      });
    });
  }, [onVisualReady]);

  const setPreloadImgRef = useCallback(
    (node) => {
      if (node?.complete && node.naturalWidth > 0) {
        notifyVisualReady();
      }
    },
    [notifyVisualReady],
  );

  useEffect(() => {
    if (!imageReady) return;
    const el = document.getElementById('splash-critical');
    if (el) el.remove();
  }, [imageReady]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: '#0a0c10',
        backgroundImage: `url('${SPLASH_BG_PUBLIC_URL}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: 'max(28px, env(safe-area-inset-bottom, 0px))',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      <img
        ref={setPreloadImgRef}
        src={SPLASH_BG_PUBLIC_URL}
        alt=""
        width={720}
        height={1555}
        loading="eager"
        decoding="sync"
        onLoad={notifyVisualReady}
        onError={notifyVisualReady}
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
          clipPath: 'inset(50%)',
        }}
        aria-hidden
      />

      {imageReady && (
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            width: 'min(340px, 85vw)',
            marginBottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
          }}
        >
          <div
            style={{
              textAlign: 'center',
              marginBottom: 10,
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: '0.04em',
              color: 'rgba(255,255,255,0.92)',
              textShadow: '0 1px 3px rgba(0,0,0,0.85), 0 0 12px rgba(0,0,0,0.5)',
            }}
            aria-hidden
          >
            {pctLabel}
          </div>
          <div
            style={{
              height: 10,
              borderRadius: 99,
              background: 'rgba(255,255,255,0.14)',
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.25)',
            }}
            role="progressbar"
            aria-valuenow={Math.round(safePct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={pctLabel}
          >
            <div
              style={{
                height: '100%',
                width: `${safePct}%`,
                borderRadius: 99,
                background: 'linear-gradient(90deg, #5c7cfa, #82c91e)',
                transition: 'width 0.35s ease-out',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
