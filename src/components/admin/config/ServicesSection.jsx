'use client';

import { Info, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { LIMITS, SERVICE_DURATION_OPTIONS } from '@shared/constants.js';
import { formatDuration } from '@shared/format.js';
import { Button, IconButton } from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Toggle } from '@/components/ui/Controls';
import { Field, Input, Select } from '@/components/ui/Field';
import { ConfigCard, SectionAlert } from './ConfigCard';
import { collapseSpaces, newService } from './configModel';

function ServiceRow({ service, index, errors, lockReason, autoFocus, onUpdate, onRemove }) {
  const nameRef = useRef(null);
  const locked = Boolean(lockReason);
  const displayName = collapseSpaces(service.name) || 'este servicio';

  useEffect(() => {
    if (autoFocus) nameRef.current?.focus();
  }, [autoFocus]);

  return (
    <li className="rounded-2xl border border-line bg-surface/55 p-3.5 sm:p-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9.5rem]">
        <Field label="Nombre del servicio" error={errors[`services.${index}.name`]}>
          {(p) => (
            <Input
              {...p}
              ref={nameRef}
              value={service.name}
              onChange={(event) => onUpdate({ name: event.target.value })}
              maxLength={LIMITS.serviceNameMax}
              placeholder="Ej.: Uñas acrílicas"
            />
          )}
        </Field>
        <Field label="Duración" error={errors[`services.${index}.durationMinutes`]}>
          {(p) => (
            <Select {...p} value={service.durationMinutes} onChange={(event) => onUpdate({ durationMinutes: Number(event.target.value) })}>
              {SERVICE_DURATION_OPTIONS.includes(service.durationMinutes) ? null : (
                <option value={service.durationMinutes}>{formatDuration(service.durationMinutes)}</option>
              )}
              {SERVICE_DURATION_OPTIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {formatDuration(minutes)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <div className="mt-3 flex items-center gap-3 border-t border-line pt-3">
        <div className="min-w-0 flex-1">
          <Toggle
            label="Activo"
            description={service.isActive ? 'Se puede reservar' : 'Oculto en la página de reservas'}
            checked={service.isActive}
            disabled={locked && service.isActive}
            onChange={(isActive) => onUpdate({ isActive })}
          />
        </div>
        <IconButton icon={Trash2} label={`Quitar ${displayName}`} variant="ghost" disabled={locked} onClick={onRemove} className="text-danger hover:bg-danger-soft" />
      </div>

      <div className="mt-2 space-y-1 text-xs">
        <p className="text-ink-3">
          {service.key ? (
            <>
              Identificador: <span className="font-mono text-ink-2">{service.key}</span>
            </>
          ) : (
            'Nuevo: el identificador se crea al guardar.'
          )}
        </p>
        {lockReason ? (
          <p className="flex items-start gap-1.5 text-ink-2">
            <Info aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0 text-info" />
            {lockReason}
          </p>
        ) : null}
      </div>
    </li>
  );
}

export function ServicesSection({ services, errors, onChange, delay, className = '' }) {
  const confirm = useConfirm();
  const [focusCid, setFocusCid] = useState(null);
  const activeCount = services.filter((s) => s.isActive).length;
  const atMax = services.length >= LIMITS.servicesMax;

  const lockReasonFor = (service) => {
    if (services.length <= 1) return 'Necesitas al menos un servicio, por eso no se puede quitar.';
    if (service.isActive && activeCount <= 1) return 'Es el único servicio activo: activa otro antes de quitarlo o desactivarlo.';
    return null;
  };

  const updateService = (cid, patch) => {
    onChange((list) => list.map((s) => (s.cid === cid ? { ...s, ...patch } : s)));
  };

  const addService = () => {
    if (atMax) return;
    const service = newService();
    onChange((list) => [...list, service]);
    setFocusCid(service.cid);
  };

  const removeService = async (service) => {
    const name = collapseSpaces(service.name);
    const ok = await confirm({
      title: name ? `¿Quitar «${name}»?` : '¿Quitar este servicio?',
      message: service.isNew
        ? 'Aún no lo has guardado, así que solo desaparecerá de la lista.'
        : 'Dejará de aparecer en la página de reservas cuando guardes los cambios. Si solo quieres ocultarlo por un tiempo, desactívalo.',
      confirmLabel: 'Quitar servicio',
      cancelLabel: 'Conservar',
      tone: 'danger',
    });
    if (ok) onChange((list) => list.filter((s) => s.cid !== service.cid));
  };

  return (
    <ConfigCard
      id="servicios"
      icon={Sparkles}
      title="Servicios"
      description="Lo que tus clientas pueden reservar y cuánto dura cada cita."
      delay={delay}
      className={className}
    >
      <SectionAlert message={errors.services} className="mb-4" />
      <ul className="space-y-3">
        {services.map((service, index) => (
          <ServiceRow
            key={service.cid}
            service={service}
            index={index}
            errors={errors}
            lockReason={lockReasonFor(service)}
            autoFocus={service.cid === focusCid}
            onUpdate={(patch) => updateService(service.cid, patch)}
            onRemove={() => removeService(service)}
          />
        ))}
      </ul>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="soft" icon={Plus} onClick={addService} disabled={atMax}>
          Agregar servicio
        </Button>
        {atMax ? <p className="text-sm text-ink-3">Máximo {LIMITS.servicesMax} servicios.</p> : null}
      </div>
      <p className="field-hint mt-3">Las citas ya agendadas conservan el nombre y la duración con que se reservaron.</p>
    </ConfigCard>
  );
}
