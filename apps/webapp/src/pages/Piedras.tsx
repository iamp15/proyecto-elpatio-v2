import { Link } from 'react-router-dom';

export default function Piedras() {
  return (
    <div style={{ padding: 16 }}>
      <Link to="/">← Volver</Link>
      <h2>Mis Piedras</h2>
      <p>Saldo: — (conectar con API)</p>
    </div>
  );
}
