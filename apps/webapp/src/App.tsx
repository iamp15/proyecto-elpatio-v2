import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { DominoSocketProvider } from './context/DominoSocketContext';
import { AudioSettingsProvider } from './context/AudioSettingsContext';
import SplashGate from './components/splash/SplashGate.jsx';
import { expandWebApp } from './lib/telegram';
import MainLayout from './components/layout/MainLayout';
import Home from './pages/Home/Home';
import LobbyDomino from './pages/Juegos/domino/LobbyDomino';
import GameDominoBoardPage from './pages/Juegos/domino/GameDominoBoardPage';
import Store from './pages/Store/Store';
import Tournaments from './pages/Tournaments/Tournaments';
import Profile from './pages/Profile/Profile';
import Wallet from './pages/Wallet/Wallet';

export default function App() {
  useEffect(() => {
    expandWebApp();
  }, []);

  return (
    <AudioSettingsProvider>
    <AuthProvider>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <DominoSocketProvider>
          <SplashGate>
            <Routes>
              <Route path="/" element={<MainLayout />}>
                <Route index element={<Home />} />
                <Route path="ligas" element={<LobbyDomino />} />
                <Route path="play/:roomId" element={<GameDominoBoardPage />} />
                <Route path="tienda" element={<Store />} />
                <Route path="torneos" element={<Tournaments />} />
                <Route path="perfil" element={<Profile />} />
                <Route path="wallet" element={<Wallet />} />
              </Route>
            </Routes>
          </SplashGate>
        </DominoSocketProvider>
      </BrowserRouter>
    </AuthProvider>
    </AudioSettingsProvider>
  );
}
