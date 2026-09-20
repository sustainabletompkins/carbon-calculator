export function Card({ children, className = '', compact = false, ...props }) {
  return (
    <div
      className={[
        'bg-surface rounded-lg border border-border shadow-sm',
        compact ? 'p-4' : 'p-6',
        className,
      ].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, icon, className = '' }) {
  return (
    <div className={['flex items-start gap-3 mb-4', className].filter(Boolean).join(' ')}>
      {icon && (
        <span className="material-icons text-primary shrink-0" style={{ fontSize: '24px' }}>
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <h3 className="text-lg font-semibold text-text leading-snug">{title}</h3>
        {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}
