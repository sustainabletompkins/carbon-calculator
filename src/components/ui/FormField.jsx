import { cloneElement, useId } from 'react';

// type defaults to "text" because index.css styles inputs by type.
export function Input({ error, className = '', type = 'text', ...props }) {
  return (
    <input
      type={type}
      className={['w-full', className].filter(Boolean).join(' ')}
      aria-invalid={error ? 'true' : undefined}
      {...props}
    />
  );
}

export function Select({ error, className = '', children, ...props }) {
  return (
    <select
      className={['w-full cursor-pointer', className].filter(Boolean).join(' ')}
      aria-invalid={error ? 'true' : undefined}
      {...props}
    >
      {children}
    </select>
  );
}

export function Textarea({ error, className = '', ...props }) {
  return (
    <textarea
      className={['w-full resize-y min-h-[100px]', className].filter(Boolean).join(' ')}
      aria-invalid={error ? 'true' : undefined}
      {...props}
    />
  );
}

export function FormField({
  label,
  error,
  helpText,
  required = false,
  className = '',
  children,
}) {
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const helpId = `${fieldId}-help`;

  const cloned = cloneElement(children, {
    id: fieldId,
    error,
    'aria-invalid': error ? 'true' : undefined,
    'aria-describedby': error ? errorId : helpText ? helpId : undefined,
  });

  return (
    <div className={['flex flex-col gap-1.5', className].filter(Boolean).join(' ')}>
      {label && (
        <label htmlFor={fieldId} className="text-sm font-semibold text-text leading-tight">
          {label}
          {required && (
            <span className="text-error ml-1" aria-label="required">*</span>
          )}
        </label>
      )}
      {cloned}
      {error && (
        <p id={errorId} role="alert" className="flex items-center gap-1.5 text-sm font-semibold text-error">
          <span className="material-icons" style={{ fontSize: '16px', lineHeight: '1' }}>error</span>
          {error}
        </p>
      )}
      {helpText && !error && (
        <p id={helpId} className="text-sm text-muted">{helpText}</p>
      )}
    </div>
  );
}
