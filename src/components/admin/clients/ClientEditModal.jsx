'use client';

import { Save } from 'lucide-react';
import { useState } from 'react';
import { formatPhone, PHONE_HINT } from '@shared/phone.js';
import { LIMITS } from '@shared/constants.js';
import { clientUpdateSchema, fieldErrorsFor } from '@shared/schemas.js';
import { ApiError, apiPatch } from '@/lib/api';
import { useAdmin } from '@/components/admin/AdminContext';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

function EditForm({ client, onDone, onCancel }) {
  const { handleError } = useAdmin();
  const toast = useToast();
  const [form, setForm] = useState({ name: client.name, phone: formatPhone(client.phone) });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (key) => (event) => {
    setForm((f) => ({ ...f, [key]: event.target.value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  async function submit(event) {
    event.preventDefault();
    const local = fieldErrorsFor(clientUpdateSchema, form);
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    setSaving(true);
    try {
      const { client: updated } = await apiPatch(`/api/admin/clients/${client.id}`, form);
      toast.success('Datos de la clienta guardados.');
      onDone(updated);
    } catch (error) {
      const fields = error instanceof ApiError ? error.fieldErrors() : {};
      if (fields.name || fields.phone) setErrors(fields);
      else handleError(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field label="Nombre" error={errors.name} required>
        {(p) => <Input {...p} value={form.name} onChange={set('name')} maxLength={LIMITS.clientNameMax} autoComplete="off" autoCapitalize="words" />}
      </Field>
      <Field label="Teléfono (WhatsApp)" hint={`${PHONE_HINT} Sus citas pasan al número nuevo.`} error={errors.phone} required>
        {(p) => <Input {...p} type="tel" inputMode="tel" value={form.phone} onChange={set('phone')} maxLength={25} autoComplete="off" />}
      </Field>
      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" icon={Save} loading={saving}>
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}

/** Edit a client's name and phone; her appointments are updated with her. */
export function ClientEditModal({ client, onClose, onSaved }) {
  return (
    <Modal open={Boolean(client)} onClose={onClose} title="Editar clienta" description="Corrige su nombre o su teléfono." size="sm" placement="top">
      {client ? (
        <EditForm
          key={client.id}
          client={client}
          onCancel={onClose}
          onDone={(updated) => {
            onSaved?.(updated);
            onClose();
          }}
        />
      ) : null}
    </Modal>
  );
}
