import { useEffect, useMemo, useState } from 'react';

const COLORS = [
  '#7DC242', '#29ABE2', '#F59E0B', '#EBF5DA',
  '#68B030', '#1A95CC', '#D97706', '#E0F4FC',
];
const SHAPES = ['●', '■', '▲', '◆', '★', '✦'];

/**
 * Lightweight confetti burst — pure CSS animations, no canvas.
 * contained=true  → position:absolute inside a relative parent
 * contained=false → position:fixed, page-level (default)
 */
export function Confetti({ count = 28, contained = false }) {
  const [visible, setVisible] = useState(true);

  const particles = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      color: COLORS[i % COLORS.length],
      shape: SHAPES[i % SHAPES.length],
      left: 5 + (i / count) * 90 + (Math.random() * 8 - 4),
      delay: Math.random() * 0.7,
      duration: 1.1 + Math.random() * 0.7,
      size: 7 + Math.random() * 9,
    })),
  [count]);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 2400);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`${contained ? 'absolute' : 'fixed'} inset-x-0 top-0 h-40 overflow-hidden pointer-events-none z-50`}
      aria-hidden="true"
    >
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute animate-confetti"
          style={{
            left: `${p.left}%`,
            top: '-20px',
            fontSize: `${p.size}px`,
            color: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        >
          {p.shape}
        </span>
      ))}
    </div>
  );
}
