const VARIANTS = {
  primary: 'bg-primary hover:bg-primary-hover text-white shadow-sm',
  secondary: 'bg-secondary hover:bg-secondary-hover text-white shadow-sm',
  ghost: 'border-2 border-primary text-primary hover:bg-primary-tint',
  outline: 'border-2 border-secondary text-secondary hover:bg-secondary-tint',
  danger: 'bg-error hover:bg-red-700 text-white shadow-sm',
  link: 'text-secondary hover:text-secondary-hover underline-offset-4 hover:underline',
};

const SIZES = {
  sm: 'px-4 py-2 text-sm min-h-[40px] rounded',
  md: 'px-5 py-2.5 text-base min-h-[48px] rounded-md',
  lg: 'px-7 py-3.5 text-lg min-h-[56px] rounded-md',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  children,
  ...props
}) {
  return (
    <button
      className={[
        'inline-flex items-center justify-center gap-2 font-semibold',
        'transition-colors duration-150 cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:pointer-events-none',
        VARIANTS[variant] ?? VARIANTS.primary,
        SIZES[size] ?? SIZES.md,
        className,
      ].filter(Boolean).join(' ')}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span
          className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}
