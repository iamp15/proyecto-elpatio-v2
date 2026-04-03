import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { DominoSocketProvider } from './context/DominoSocketContext';
import { AudioSettingsProvider } from './context/AudioSettingsContext';
import { expandWebApp } from './lib/telegram';
import MainLayout from './components/layout/MainLayout';
import Juegos from './pages/Juegos/Juegos';
import LobbyDomino from './pages/Juegos/domino/LobbyDomino';
import GameDominoBoardPage from './pages/Juegos/domino/GameDominoBoardPage';
import Piedras from './pages/Piedras';
import Wallet from './pages/Wallet/Wallet';
import Settings from './pages/Settings/Settings';
import Profile from './pages/Profile/Profile';

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
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Juegos />} />
            <Route path="lobby-domino" element={<LobbyDomino />} />
            <Route path="juegos/domino/:roomId" element={<GameDominoBoardPage />} />
            <Route path="wallet" element={<Wallet />} />
            <Route path="settings" element={<Settings />} />
            <Route path="piedras" element={<Piedras />} />
            <Route path="profile" element={<Profile />} />
          </Route>
        </Routes>
        </DominoSocketProvider>
      </BrowserRouter>
    </AuthProvider>
    </AudioSettingsProvider>
  );
}
