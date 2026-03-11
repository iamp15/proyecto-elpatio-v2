import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

/** Formas SVG de rayos ramificados (path d). */
const BOLT_PATHS = [
  'M 50 0 L 35 25 L 45 25 L 25 55 L 40 55 L 15 100 L 35 65 L 28 65 L 50 35 L 42 35 Z',
  'M 50 0 L 30 30 L 50 30 L 20 60 L 45 60 L 10 100 L 38 70 L 25 70 L 50 40 L 40 40 Z',
  'M 50 0 L 40 20 L 50 20 L 35 45 L 48 45 L 25 75 L 42 75 L 15 100 L 35 80 L 30 80 L 50 55 L 45 55 Z',
];

export default function LightningBolt({ glowColor = '#80deea', variant = 0 }) {
  const [key, setKey] = useState(0);
  const [position, setPosition] = useState({ top: '20%', left: '15%', scale: 0.6, rotate: -15 });
  const [delay, setDelay] = useState(0);

  useEffect(() => {
    const randomize = () => {
      setPosition({
        top:    `${15 + Math.random() * 70}%`,
        left:   `${5 + Math.random() * 85}%`,
        scale:  0.3 + Math.random() * 0.7,
        rotate: -45 + Math.random() * 90,
      });
      setDelay(Math.random() * 2 + 0.5);
      setKey((k) => k + 1);
    };

    const interval = setInterval(randomize, 2500 + Math.random() * 2000);
    randomize();
    return () => clearInterval(interval);
  }, []);

  const pathIndex = variant % BOLT_PATHS.length;
  const filterStyle = `drop-shadow(0 0 12px ${glowColor}) drop-shadow(0 0 24px ${glowColor}88)`;

  return (
    <motion.div
      key={key}
      className="absolute pointer-events-none"
      style={{
        top: position.top,
        left: position.left,
        width: 80,
        height: 120,
        transform: `scale(${position.scale}) rotate(${position.rotate}deg)`,
        transformOrigin: 'center center',
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 0.5, 1, 0] }}
      transition={{ duration: 0.3, delay, ease: 'easeOut' }}
    >
      <svg
        viewBox="0 0 50 100"
        style={{ width: '100%', height: '100%', filter: filterStyle }}
      >
        <path
          d={BOLT_PATHS[pathIndex]}
          fill="none"
          stroke="#ffffff"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </motion.div>
  );
}
