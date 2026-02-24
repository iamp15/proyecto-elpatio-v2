import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

console.log('[ElPatio] main.tsx cargado (bundle con logs de login)');

declare const __NODE_ENV__: string;
// Eruda: solo si NODE_ENV=development (inyectado en build)
if (__NODE_ENV__ === 'development') {
  import('eruda').then(({ default: eruda }) => eruda.init());
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
