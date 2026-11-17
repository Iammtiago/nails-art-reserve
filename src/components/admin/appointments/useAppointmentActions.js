'use client';

import { useCallback, useRef, useState } from 'react';
import { formatDateLong, formatTime } from '@shared/format.js';
import { ApiError, apiPatch } from '@/lib/api';
import { useAdmin } from '@/components/admin/AdminContext';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { firstName } from './appointmentUtils';

/**
 * «Asistió» and «Cancelar» for one appointment at a time.
 * onChanged(updatedAppointment | null, id) runs after every attempt that changed (or
 * revealed a change in) the server state; null means the appointment was no longer confirmed.
 */
export function useAppointmentActions(onChanged) {
  const toast = useToast();
  const confirm = useConfirm();
  const { handleError } = useAdmin();
  const [busy, setBusy] = useState(null);
  const busyRef = useRef(false);
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;

  const run = useCallback(
    async (appointment, action) => {
      if (busyRef.current) return null;
      busyRef.current = true;
      setBusy({ id: appointment.id, action });
      try {
        const response = await apiPatch(`/api/admin/appointments/${appointment.id}/${action}`);
        const name = firstName(appointment.clientName);
        let message = 'Cita cancelada. El horario quedó libre.';
        if (action === 'complete') message = `Asistencia registrada${name ? ` para ${name}` : ''}.`;
        else if (appointment.kind === 'block') message = 'Horario liberado.';
        toast.success(message);
        onChangedRef.current?.(response?.appointment || null, appointment.id);
        return response?.appointment || null;
      } catch (error) {
        handleError(error);
        if (error instanceof ApiError && (error.status === 404 || error.status === 409)) onChangedRef.current?.(null, appointment.id);
        return null;
      } finally {
        busyRef.current = false;
        setBusy(null);
      }
    },
    [toast, handleError],
  );

  const complete = useCallback((appointment) => run(appointment, 'complete'), [run]);

  const cancel = useCallback(
    async (appointment) => {
      if (busyRef.current) return null;
      if (appointment.kind === 'block') {
        const free = await confirm({
          title: '¿Liberar este horario?',
          message: `${formatDateLong(appointment.date)}, ${formatTime(appointment.timeSlot)} – ${formatTime(appointment.endTime)}. Las clientas podrán reservarlo de nuevo.`,
          confirmLabel: 'Liberar horario',
          cancelLabel: 'Volver',
        });
        return free ? run(appointment, 'cancel') : null;
      }
      const accepted = await confirm({
        title: '¿Cancelar esta cita?',
        message: `${appointment.clientName} · ${appointment.serviceName} · ${formatDateLong(appointment.date)}, ${formatTime(appointment.timeSlot)}. El horario quedará libre.`,
        confirmLabel: 'Cancelar cita',
        cancelLabel: 'Volver',
        tone: 'danger',
      });
      if (!accepted) return null;
      return run(appointment, 'cancel');
    },
    [confirm, run],
  );

  /** Busy action ('complete' | 'cancel') for this appointment, or null. */
  const busyFor = useCallback((id) => (busy && busy.id === id ? busy.action : null), [busy]);

  return { busy, busyFor, complete, cancel };
}
