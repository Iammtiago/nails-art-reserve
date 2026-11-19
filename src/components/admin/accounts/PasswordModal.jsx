'use client';

import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { ApiError, apiPatch } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { PasswordInput } from '@/components/ui/PasswordInput';

const EMPTY = { currentPassword: '', password: '', passwordConfirm: '' };

function PasswordForm({ account, onDone, onCancel }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const self = account.isSelf;

  const update = (key) => (event) => {
    setForm((f) => ({ ...f, [key]: event.target.value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    setFormError('');
  };

  async function submit(event) {
    event.preventDefault();
    const local = {};
    if (self && !form.currentPassword) local.currentPassword = 'Escribe tu contraseña actual.';
    if (form.password.length < 6) local.password = 'La contraseña necesita al menos 6 caracteres.';
    if (form.password !== form.passwordConfirm) local.passwordConfirm = 'Las contraseñas no coinciden.';
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    setLoading(true);
    try {
      const body = { password: form.password, passwordConfirm: form.passwordConfirm };
      if (self) body.currentPassword = form.currentPassword;
      await apiPatch(`/api/admin/accounts/${account.id}/password`, body);
      onDone();
    } catch (error) {
      if (error instanceof ApiError && error.details.length) setErrors(error.fieldErrors());
      else setFormError(error instanceof ApiError ? error.message : 'No pudimos cambiar la contraseña. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {self ? (
        <Field label="Contraseña actual" error={errors.currentPassword}>
          {(p) => <PasswordInput {...p} value={form.currentPassword} onChange={update('currentPassword')} autoComplete="current-password" />}
        </Field>
      ) : null}
      <Field label="Nueva contraseña" hint="Mínimo 6 caracteres." error={errors.password}>
        {(p) => <PasswordInput {...p} value={form.password} onChange={update('password')} autoComplete="new-password" />}
      </Field>
      <Field label="Repite la nueva contraseña" error={errors.passwordConfirm}>
        {(p) => <PasswordInput {...p} value={form.passwordConfirm} onChange={update('passwordConfirm')} autoComplete="new-password" />}
      </Field>
      {formError ? (
        <p className="rounded-xl bg-danger-soft px-3 py-2.5 text-sm font-medium text-danger" role="alert">
          {formError}
        </p>
      ) : null}
      <div className="sticky bottom-0 -mx-1 flex flex-col-reverse gap-2 bg-transparent px-1 pt-3 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={loading} icon={KeyRound}>
          Guardar contraseña
        </Button>
      </div>
    </form>
  );
}

export function PasswordModal({ account, onClose, onDone }) {
  const open = Boolean(account);
  const description = account?.isSelf
    ? 'Tu sesión sigue abierta aquí; en otros equipos tendrás que volver a entrar.'
    : `Úsalo si ${account?.username || 'esta persona'} olvidó su contraseña. Tendrá que entrar con la nueva.`;
  return (
    <Modal open={open} onClose={onClose} title={account?.isSelf ? 'Cambiar mi contraseña' : `Nueva contraseña para ${account?.username || ''}`} description={description} size="sm">
      {open ? <PasswordForm account={account} onDone={onDone} onCancel={onClose} /> : null}
    </Modal>
  );
}
