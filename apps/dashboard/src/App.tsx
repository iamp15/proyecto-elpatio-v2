import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Metrics from './pages/Metrics';
import Config from './pages/Config';

export default function App() {
  return (
    <BrowserRouter>
      <nav style={{ padding: 16, borderBottom: '1px solid #eee' }}>
        <Link to="/" style={{ marginRight: 16 }}>Métricas</Link>
        <Link to="/config">Configuración</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Metrics />} />
        <Route path="/config" element={<Config />} />
      </Routes>
    </BrowserRouter>
  );
}
