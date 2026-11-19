'use client';

import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { accountSchema, fieldErrorsFor } from '@shared/schemas.js';
import { ApiError, apiPost } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { PasswordInput } from '@/components/ui/PasswordInput';

const EMPTY = { username: '', password: '', passwordConfirm: '' };

const validate = (form) => fieldErrorsFor(accountSchema, form);

/** Mounted only while open, so the form starts clean every time. */
function AccountForm({ onCreated, onCancel }) {
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
    const local = validate(form);
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    setLoading(true);
    try {
      const { account } = await apiPost('/api/admin/accounts', { ...form, username: form.username.trim() });
      onCreated(account);
    } catch (error) {
      if (error instanceof ApiError && error.details.length) setErrors(error.fieldErrors());
      else setFormError(error instanceof ApiError ? error.message : 'No pudimos crear la cuenta. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field label="Usuario" hint="Con este nombre entrará al panel. Sin espacios ni acentos." error={errors.username}>
        {(p) => <Input {...p} value={form.username} onChange={update('username')} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="ej. maria" />}
      </Field>
      <Field label="Contraseña" hint="Mínimo 6 caracteres. Dísela en persona, no por chat." error={errors.password}>
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
      <div className="sticky bottom-0 -mx-1 flex flex-col-reverse gap-2 bg-transparent px-1 pt-3 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={loading} icon={UserPlus}>
          Crear cuenta
        </Button>
      </div>
    </form>
  );
}

export function AccountFormModal({ open, onClose, onCreated }) {
  return (
    <Modal open={open} onClose={onClose} title="Nueva cuenta" description="Tendrá acceso completo al panel, igual que tú." size="sm">
      {open ? <AccountForm onCreated={onCreated} onCancel={onClose} /> : null}
    </Modal>
  );
}
