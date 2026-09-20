import { useEffect, useRef, useState } from 'react';

export function InfoPopover({ label, title, children, align = 'end', className = '' }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const closeOnOutsideClick = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      className={['relative inline-block', className].filter(Boolean).join(' ')}
    >
      <button
        type="button"
        onClick={() => setOpen((isOpen) => !isOpen)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 whitespace-nowrap rounded text-xs font-medium text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary/50"
      >
        <span className="material-icons" style={{ fontSize: '16px' }}>
          info
        </span>
        {label}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={title || label}
          className={[
            'absolute z-20 mt-2 w-[min(18rem,calc(100vw-3rem))] sm:w-80 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-4 text-left shadow-lg',
            align === 'end' ? 'right-0' : 'left-0',
          ].join(' ')}
        >
          {title && (
            <p className="mb-2 text-sm font-semibold text-text-light dark:text-text-dark">
              {title}
            </p>
          )}
          <div className="space-y-2 text-xs text-gray-700 dark:text-gray-300">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
