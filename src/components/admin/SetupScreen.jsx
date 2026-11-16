'use client';

// One-time superadmin creation, open (no install key) until the first account exists —
// Tiago's decision of 2026-11-16. Remove this file, src/app/admin/setup and the
// /api/auth/setup route once he confirms the accounts exist (see README, "Superadmin").

import { CheckCircle2, ShieldCheck, Sparkles, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { fieldErrorsFor, setupSchema } from '@shared/schemas.js';
import { ApiError, apiGet, apiPost } from '@/lib/api';
import { useAsync } from '@/lib/hooks';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { ErrorState, LoadingState } from '@/components/ui/States';

const EMPTY = { username: '', password: '', passwordConfirm: '' };

const validateLocally = (form) => fieldErrorsFor(setupSchema, form);

export function SetupScreen() {
  const router = useRouter();
  const status = useAsync((signal) => apiGet('/api/auth/status', null, { signal }), []);
  const [form, setForm] = useState(EMPTY);
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
    const local = validateLocally(form);
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    setLoading(true);
    try {
      await apiPost('/api/auth/setup', { ...form, username: form.username.trim() });
      router.replace('/admin/cuentas?bienvenida=1');
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors());
        setFormError(error.message);
        if (error.status === 410) status.reload({ silent: true });
      } else {
        setFormError('No pudimos crear la cuenta. Intenta de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  }

  let body;
  if (status.loading) body = <LoadingState label="Comprobando instalación…" />;
  else if (status.error) body = <ErrorState error={status.error} onRetry={() => status.reload()} />;
  else if (status.data?.hasAdmin) {
    body = (
      <div className="flex flex-col items-center py-4 text-center">
        <CheckCircle2 aria-hidden="true" className="mb-3 h-12 w-12 text-success" />
        <h1 className="font-display text-2xl font-semibold">La cuenta principal ya existe</h1>
        <p className="mt-2 text-sm text-ink-2">Esta página ya no crea cuentas. Entra al panel con tu usuario; desde «Cuentas» puedes crear la de la manicurista.</p>
        <Button href="/admin" className="mt-6" size="lg">
          Ir al panel
        </Button>
      </div>
    );
  } else {
    body = (
      <>
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-secondary-soft text-primary-ink shadow-glass">
            <ShieldCheck aria-hidden="true" className="h-7 w-7" />
          </div>
          <p className="eyebrow">Instalación · solo una vez</p>
          <h1 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">Crea tu cuenta de superadmin</h1>
          <p className="mt-2 text-sm text-ink-2">Será la cuenta principal del panel. En cuanto la crees, esta página se cierra para todos.</p>
        </div>

        <ol className="mb-6 grid gap-2 text-sm text-ink-2" aria-label="Pasos">
          <li className="flex items-center gap-2.5 rounded-xl bg-primary-soft/70 px-3 py-2">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-on">1</span>
            Crea aquí tu usuario y contraseña.
          </li>
          <li className="flex items-center gap-2.5 rounded-xl bg-primary-soft/40 px-3 py-2">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface text-xs font-bold text-primary-ink ring-1 ring-line">2</span>
            En «Cuentas», crea la de la manicurista.
          </li>
        </ol>

        <form onSubmit={submit} noValidate className="space-y-4">
          <Field label="Usuario" hint="Con este nombre entrarás al panel. Sin espacios ni acentos." error={errors.username}>
            {(p) => <Input {...p} value={form.username} onChange={update('username')} autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="ej. tiago" />}
          </Field>
          <Field label="Contraseña" hint="Mínimo 10 caracteres. Mejor una frase que recuerdes." error={errors.password}>
            {(p) => <PasswordInput {...p} value={form.password} onChange={update('password')} autoComplete="new-password" />}
          </Field>
          <Field label="Repite la contraseña" error={errors.passwordConfirm}>
            {(p) => <PasswordInput {...p} value={form.passwordConfirm} onChange={update('passwordConfirm')} autoComplete="new-password" />}
          </Field>
          {formError ? (
            <p className="rounded-xl bg-danger-soft px-3 py-2.5 text-sm font-medium text-danger" role="alert">
              {formError}
            </p>
          ) : null}
          <Button type="submit" size="lg" block loading={loading} icon={UserPlus}>
            Crear mi cuenta y entrar
          </Button>
        </form>
        <p className="mt-4 flex items-start justify-center gap-1.5 text-center text-xs text-ink-3">
          <Sparkles aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Nadie más verá tu contraseña: se guarda cifrada.
        </p>
      </>
    );
  }

  return (
    <div className="relative grid min-h-dvh place-items-center px-4 py-10">
      <div className="aurora aurora-animated" aria-hidden="true">
        <span />
      </div>
      <div className="glass glass-strong w-full max-w-md p-6 enter sm:p-8">{body}</div>
    </div>
  );
}
