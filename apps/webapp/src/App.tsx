import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import { WebApp } from '@twa-dev/sdk';
import Lobby from './pages/Lobby';
import Piedras from './pages/Piedras';

export default function App() {
  useEffect(() => {
    WebApp.ready();
    WebApp.expand();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Lobby />} />
        <Route path="/piedras" element={<Piedras />} />
      </Routes>
    </BrowserRouter>
  );
}
