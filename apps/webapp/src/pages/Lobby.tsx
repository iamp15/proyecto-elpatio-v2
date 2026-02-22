import { Link } from 'react-router-dom';

export default function Lobby() {
  return (
    <div style={{ padding: 16 }}>
      <h1>El Patio</h1>
      <p>Elige un juego</p>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Link to="/piedras">Monedero (Piedras)</Link>
        <span>Ludo (próximamente)</span>
        <span>Dominó (próximamente)</span>
      </nav>
    </div>
  );
}
