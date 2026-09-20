const VARIANTS = {
  error: {
    outer: 'bg-error-bg border-error',
    text: 'text-error',
    icon: 'error',
  },
  success: {
    outer: 'bg-success-bg border-success',
    text: 'text-success',
    icon: 'check_circle',
  },
  warning: {
    outer: 'bg-warning-bg border-warning',
    text: 'text-warning',
    icon: 'warning',
  },
  info: {
    outer: 'bg-secondary-tint border-secondary',
    text: 'text-secondary',
    icon: 'info',
  },
};

export function Alert({ variant = 'info', title, children, onClose, className = '' }) {
  const v = VARIANTS[variant] ?? VARIANTS.info;

  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={[
        'flex items-start gap-3 rounded-md border-l-4 px-4 py-3',
        v.outer,
        className,
      ].filter(Boolean).join(' ')}
    >
      <span
        className={['material-icons shrink-0 mt-0.5', v.text].join(' ')}
        style={{ fontSize: '20px', lineHeight: '1' }}
        aria-hidden="true"
      >
        {v.icon}
      </span>
      <div className="flex-1 min-w-0">
        {title && (
          <p className={['font-semibold text-sm leading-tight', v.text].join(' ')}>{title}</p>
        )}
        {children && (
          <p className={['text-sm', title ? 'mt-1' : '', v.text].filter(Boolean).join(' ')}>
            {children}
          </p>
        )}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className={['shrink-0 opacity-60 hover:opacity-100 transition-opacity', v.text].join(' ')}
          aria-label="Dismiss"
        >
          <span className="material-icons" style={{ fontSize: '18px' }}>close</span>
        </button>
      )}
    </div>
  );
}
