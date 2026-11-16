'use client';

// One-time superadmin creation. Remove this file, src/app/admin/setup and the
// /api/auth/setup route once the account exists (see README, "Superadmin").

import { CheckCircle2, Eye, EyeOff, ShieldCheck, ShieldOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError, apiGet, apiPost } from '@/lib/api';
import { useAsync } from '@/lib/hooks';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { ErrorState, LoadingState } from '@/components/ui/States';

const EMPTY = { setupKey: '', username: '', password: '', passwordConfirm: '' };

export function SetupScreen() {
  const router = useRouter();
  const status = useAsync((signal) => apiGet('/api/auth/status', null, { signal }), []);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const update = (key) => (event) => {
    setForm((f) => ({ ...f, [key]: event.target.value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    setFormError('');
  };

  function validateLocally() {
    const e = {};
    if (!form.setupKey) e.setupKey = 'Escribe la clave de instalación.';
    if (!/^[a-zA-Z0-9._-]{3,40}$/.test(form.username.trim())) e.username = 'Usa 3 a 40 letras sin acentos, números, punto o guion.';
    if (form.password.length < 10) e.password = 'La contraseña necesita al menos 10 caracteres.';
    if (form.password !== form.passwordConfirm) e.passwordConfirm = 'Las contraseñas no coinciden.';
    return e;
  }

  async function submit(event) {
    event.preventDefault();
    const local = validateLocally();
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    setLoading(true);
    try {
      await apiPost('/api/auth/setup', { ...form, username: form.username.trim() });
      router.replace('/admin/citas');
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
        <h1 className="font-display text-2xl font-semibold">El superadmin ya existe</h1>
        <p className="mt-2 text-sm text-ink-2">La instalación está cerrada. Entra al panel con tu usuario y contraseña.</p>
        <Button href="/admin" className="mt-6" size="lg">
          Ir al panel
        </Button>
      </div>
    );
  } else if (!status.data?.setupKeyConfigured) {
    body = (
      <div className="py-2">
        <ShieldOff aria-hidden="true" className="mb-3 h-10 w-10 text-warning" />
        <h1 className="font-display text-2xl font-semibold">Falta la clave de instalación</h1>
        <p className="mt-2 text-sm text-ink-2">
          Para crear el superadmin, agrega en Vercel la variable <code className="rounded bg-primary-soft px-1.5 py-0.5 font-mono text-[0.8rem]">ADMIN_SETUP_KEY</code>{' '}
          con una clave que solo tú conozcas (mínimo 12 caracteres) y vuelve a desplegar.
        </p>
      </div>
    );
  } else {
    body = (
      <>
        <div className="mb-6 text-center">
          <ShieldCheck aria-hidden="true" className="mx-auto mb-3 h-11 w-11 text-accent-ink" />
          <p className="eyebrow">Instalación · solo una vez</p>
          <h1 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">Crear superadmin</h1>
          <p className="mt-1 text-sm text-ink-2">Esta cuenta administra todo el panel. Al crearla, esta página se cierra.</p>
        </div>
        <form onSubmit={submit} noValidate className="space-y-4">
          <Field label="Clave de instalación" hint="La que pusiste en ADMIN_SETUP_KEY en Vercel." error={errors.setupKey}>
            {(p) => <Input {...p} type="password" value={form.setupKey} onChange={update('setupKey')} autoComplete="off" />}
          </Field>
          <Field label="Usuario" hint="Con este nombre entrarás al panel." error={errors.username}>
            {(p) => <Input {...p} value={form.username} onChange={update('username')} autoComplete="username" autoCapitalize="none" spellCheck={false} />}
          </Field>
          <Field label="Contraseña" hint="Mínimo 10 caracteres." error={errors.password}>
            {(p) => (
              <div className="relative">
                <Input {...p} type={show ? 'text' : 'password'} value={form.password} onChange={update('password')} autoComplete="new-password" className="pr-12" />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="absolute inset-y-0 right-0 grid w-12 place-items-center text-ink-3 hover:text-ink"
                  aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {show ? <EyeOff aria-hidden="true" className="h-5 w-5" /> : <Eye aria-hidden="true" className="h-5 w-5" />}
                </button>
              </div>
            )}
          </Field>
          <Field label="Repite la contraseña" error={errors.passwordConfirm}>
            {(p) => <Input {...p} type={show ? 'text' : 'password'} value={form.passwordConfirm} onChange={update('passwordConfirm')} autoComplete="new-password" />}
          </Field>
          {formError ? (
            <p className="rounded-xl bg-danger-soft px-3 py-2.5 text-sm font-medium text-danger" role="alert">
              {formError}
            </p>
          ) : null}
          <Button type="submit" size="lg" block loading={loading} icon={ShieldCheck}>
            Crear superadmin y entrar
          </Button>
        </form>
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
