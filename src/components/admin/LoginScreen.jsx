'use client';

import { KeyRound, LogIn, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { ApiError, apiPost } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { ErrorState } from '@/components/ui/States';

export function LoginScreen({ status, statusError, onRetry, onSuccess }) {
  const [form, setForm] = useState({ username: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (key) => (event) => {
    setForm((f) => ({ ...f, [key]: event.target.value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    setFormError('');
  };

  async function submit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!form.username.trim()) nextErrors.username = 'Escribe tu usuario.';
    if (!form.password) nextErrors.password = 'Escribe tu contraseña.';
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    setLoading(true);
    try {
      await apiPost('/api/auth/login', { username: form.username.trim(), password: form.password });
      onSuccess();
    } catch (error) {
      if (error instanceof ApiError && error.details.length) setErrors(error.fieldErrors());
      setFormError(error instanceof ApiError ? error.message : 'No pudimos iniciar sesión. Intenta de nuevo.');
      setForm((f) => ({ ...f, password: '' }));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative grid min-h-dvh place-items-center px-4 py-10">
      <div className="aurora aurora-animated" aria-hidden="true">
        <span />
      </div>
      <div className="glass glass-strong w-full max-w-md p-6 enter sm:p-8">
        {statusError ? (
          <ErrorState error={statusError} onRetry={onRetry} className="py-4" />
        ) : (
          <>
            <div className="mb-6 flex flex-col items-center text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Logo de Nails Art" width={84} height={84} className="mb-4 h-[84px] w-[84px] rounded-full shadow-lift ring-4 ring-white/80" />
              <p className="eyebrow">Panel de administración</p>
              <h1 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">Hola de nuevo</h1>
              <p className="mt-1 text-sm text-ink-2">Entra para gestionar citas, clientas y horarios.</p>
            </div>

            {status?.setupAvailable ? (
              <div className="mb-5 flex items-start gap-3 rounded-2xl bg-accent-soft p-4 text-sm text-ink">
                <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-accent-ink" />
                <div>
                  <p className="font-semibold">Aún no hay ninguna cuenta.</p>
                  <p className="mt-0.5 text-ink-2">Crea la cuenta principal (superadmin) para empezar.</p>
                  <Link href="/admin/setup" className="mt-2 inline-flex min-h-[44px] items-center font-semibold text-primary-ink underline underline-offset-4">
                    Crear cuenta principal
                  </Link>
                </div>
              </div>
            ) : null}

            <form onSubmit={submit} noValidate className="space-y-4">
              <Field label="Usuario" error={errors.username}>
                {(p) => <Input {...p} value={form.username} onChange={update('username')} autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="tu-usuario" />}
              </Field>
              <Field label="Contraseña" error={errors.password}>
                {(p) => <PasswordInput {...p} value={form.password} onChange={update('password')} autoComplete="current-password" />}
              </Field>
              {formError ? (
                <p className="flex items-start gap-2 rounded-xl bg-danger-soft px-3 py-2.5 text-sm font-medium text-danger" role="alert">
                  <KeyRound aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                  {formError}
                </p>
              ) : null}
              <Button type="submit" size="lg" block loading={loading} icon={LogIn}>
                Entrar al panel
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
