import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useDominoSocket } from '../../context/DominoSocketContext';
import { useSplashPhase } from '../../context/SplashPhaseContext';
import audioManager from '../../pages/Juegos/domino/audio/AudioManager.js';
import SplashScreen from './SplashScreen.jsx';
import {
  checkActiveGame,
  fetchLobbyRooms,
  fetchUserProfile,
  waitForDominoSocketInstance,
  waitForLobbyWithTimeout,
} from './fetchAppBootData.js';
import { splashMinimumDelayPromise } from './splashConstants.js';

/**
 * Prefetch en paralelo (perfil, lobby socket, handshake de partida activa) y tiempo mínimo de splash.
 * Inyecta datos vía Auth y DominoSocket; difiere navegación reconnect hasta terminar.
 */
export default function SplashGate({ children }) {
  const { phase, completeSplashPhase } = useSplashPhase();
  const { token, refreshUser, refreshBalance, authBootComplete } = useAuth();
  const {
    socket,
    waitForLobbyConfig,
    pendingReconnectRoomId,
    clearPendingReconnect,
  } = useDominoSocket();
  const navigate = useNavigate();

  const [progress, setProgress] = useState(0);
  const [splashVisualReady, setSplashVisualReady] = useState(false);
  const stepsDone = useRef(0);
  const socketRef = useRef(socket);
  socketRef.current = socket;

  const handleSplashVisualReady = useCallback(() => {
    setSplashVisualReady(true);
  }, []);

  useLayoutEffect(() => {
    audioManager.setAppMusicPlaybackAllowed(phase === 'ready');
  }, [phase]);

  useEffect(() => {
    if (phase !== 'ready') return;
    if (!pendingReconnectRoomId) return;
    navigate(`/play/${pendingReconnectRoomId}`, {
      replace: true,
      state: { fromReconnect: true },
    });
    clearPendingReconnect();
  }, [phase, pendingReconnectRoomId, navigate, clearPendingReconnect]);

  useEffect(() => {
    if (phase !== 'splash') return;
    if (!authBootComplete) return;
    if (!splashVisualReady) return;

    let cancelled = false;

    const bump = () => {
      if (cancelled) return;
      stepsDone.current += 1;
      setProgress(Math.min(100, Math.round((stepsDone.current / 3) * 100)));
    };

    async function runBoot() {
      const dataTasks = [];

      if (token) {
        const s = await waitForDominoSocketInstance(socketRef);
        dataTasks.push(
          fetchUserProfile(refreshUser, refreshBalance).finally(bump),
          waitForLobbyWithTimeout(() => fetchLobbyRooms(waitForLobbyConfig)).finally(bump),
          checkActiveGame(s).finally(bump),
        );
      } else {
        bump();
        bump();
        bump();
      }

      try {
        await Promise.all([Promise.all(dataTasks), splashMinimumDelayPromise()]);
      } catch (e) {
        console.warn('[Splash] Prefetch:', e?.message || e);
      } finally {
        if (!cancelled) {
          completeSplashPhase();
        }
      }
    }

    void runBoot();
    return () => {
      cancelled = true;
    };
  }, [
    phase,
    authBootComplete,
    token,
    refreshUser,
    refreshBalance,
    waitForLobbyConfig,
    completeSplashPhase,
    splashVisualReady,
  ]);

  if (phase === 'splash') {
    return <SplashScreen progress={progress} onVisualReady={handleSplashVisualReady} />;
  }

  return children;
}
