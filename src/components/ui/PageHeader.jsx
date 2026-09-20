export function PageHeader({ title, subtitle, className = '' }) {
  return (
    <div className={['text-center mb-3', className].filter(Boolean).join(' ')}>
      <h2 className="text-lg sm:text-xl font-semibold mb-0.5 text-text-light dark:text-text-dark">
        {title}
      </h2>
      {subtitle && (
        <p className="text-xs sm:text-sm text-muted-light dark:text-muted-dark">
          {subtitle}
        </p>
      )}
    </div>
  );
}
