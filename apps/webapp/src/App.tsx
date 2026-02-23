import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import { WebApp } from '@twa-dev/sdk';
import { UserProvider } from './context/UserContext';
import Lobby from './pages/Lobby';
import Piedras from './pages/Piedras';
import Home from './pages/Home/Home';
import Wallet from './pages/Wallet/Wallet';

export default function App() {
  useEffect(() => {
    if (typeof WebApp !== 'undefined') {
      WebApp.ready();
      WebApp.expand();
    }
  }, []);

  return (
    <UserProvider>
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        <Route path="/" element={<Lobby />} />
        <Route path="/home" element={<Home />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/piedras" element={<Piedras />} />
      </Routes>
    </BrowserRouter>
    </UserProvider>
  );
}
