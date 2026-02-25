import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Lobby from './pages/Lobby';
import Piedras from './pages/Piedras';
import Home from './pages/Home/Home';
import Wallet from './pages/Wallet/Wallet';

export default function App() {
  return (
    <AuthProvider>
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
    </AuthProvider>
  );
}
