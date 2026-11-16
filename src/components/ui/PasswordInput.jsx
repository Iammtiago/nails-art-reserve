'use client';

import { Eye, EyeOff } from 'lucide-react';
import { forwardRef, useState } from 'react';
import { Input } from './Field';

/** Password field with a show/hide toggle. Use inside <Field>: {(p) => <PasswordInput {...p} … />} */
export const PasswordInput = forwardRef(function PasswordInput({ className = '', ...props }, ref) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input ref={ref} {...props} type={show ? 'text' : 'password'} className={`pr-12 ${className}`} />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-xl text-ink-3 transition hover:text-ink"
        aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={show}
      >
        {show ? <EyeOff aria-hidden="true" className="h-5 w-5" /> : <Eye aria-hidden="true" className="h-5 w-5" />}
      </button>
    </div>
  );
});
