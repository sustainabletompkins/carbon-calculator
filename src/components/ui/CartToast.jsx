import { useContext, useEffect, useState } from 'react';
import { CartContext } from '../../contexts/CartContext';

const ITEM_ICON = {
  donation: 'favorite',
  car: 'directions_car',
  air: 'flight',
  home: 'home',
};

export function CartToast() {
  const { toastItem } = useContext(CartContext);
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [current, setCurrent] = useState(null);

  useEffect(() => {
    if (!toastItem) return;
    setCurrent(toastItem);
    setExiting(false);
    setVisible(true);

    const exitTimer = setTimeout(() => setExiting(true), 2600);
    const hideTimer = setTimeout(() => setVisible(false), 2900);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(hideTimer);
    };
  }, [toastItem]);

  if (!visible || !current) return null;

  const icon = ITEM_ICON[current.type] ?? ITEM_ICON[current.tripMode] ?? 'eco';
  const label = current.type === 'donation'
    ? 'Direct Donation'
    : current.tripMode === 'car' ? 'Car trip offset'
    : current.tripMode === 'air' ? 'Flight offset'
    : 'Carbon offset';

  return (
    <div
      className={`fixed bottom-6 right-6 z-[200] ${exiting ? 'animate-slide-down' : 'animate-slide-up'}`}
      role="status"
      aria-live="polite"
    >
      <div className="bg-surface border-2 border-primary rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 max-w-[280px]">
        {/* Icon with sparkles */}
        <div className="relative shrink-0">
          <div className="w-11 h-11 rounded-full bg-primary-tint flex items-center justify-center animate-bounce-in">
            <span className="material-icons text-primary" style={{ fontSize: '22px' }}>{icon}</span>
          </div>
          <span
            className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-brand-blue animate-pop-in"
            style={{ animationDelay: '0.12s' }}
            aria-hidden="true"
          />
          <span
            className="absolute -bottom-1 -left-1 w-2.5 h-2.5 rounded-full bg-warning animate-pop-in"
            style={{ animationDelay: '0.22s' }}
            aria-hidden="true"
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm text-primary leading-tight">Added to cart!</p>
          <p className="text-xs text-muted truncate mt-0.5">{label}</p>
          <p className="text-xs font-semibold text-text mt-0.5">${current.cost?.toFixed(2)}</p>
        </div>

        <span className="material-icons text-primary-tint shrink-0" style={{ fontSize: '16px' }} aria-hidden="true">
          eco
        </span>
      </div>
    </div>
  );
}
