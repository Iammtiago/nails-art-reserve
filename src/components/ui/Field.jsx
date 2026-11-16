'use client';

import { AlertCircle } from 'lucide-react';
import { forwardRef, useId } from 'react';

/**
 * Label above, control, then hint or error. Pass the control as a render function to get ids:
 * <Field label="Nombre" error={e}>{(p) => <Input {...p} />}</Field>
 */
export function Field({ label, hint, error, required = false, className = '', children, id: idProp }) {
  const autoId = useId();
  const id = idProp || `f${autoId.replace(/:/g, '')}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;
  const controlProps = { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy, required };

  return (
    <div className={className}>
      {label ? (
        <label htmlFor={id} className="field-label">
          {label}
          {required ? <span className="text-danger" aria-hidden="true"> *</span> : null}
        </label>
      ) : null}
      {typeof children === 'function' ? children(controlProps) : children}
      {error ? (
        <p id={errorId} className="field-error" role="alert">
          <AlertCircle aria-hidden="true" className="mt-px h-4 w-4 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef(function Input({ className = '', ...props }, ref) {
  return <input ref={ref} className={`input ${className}`} {...props} />;
});

export const Select = forwardRef(function Select({ className = '', children, ...props }, ref) {
  return (
    <select ref={ref} className={`input ${className}`} {...props}>
      {children}
    </select>
  );
});

export const Textarea = forwardRef(function Textarea({ className = '', ...props }, ref) {
  return <textarea ref={ref} className={`input min-h-[96px] py-3 ${className}`} {...props} />;
});
