'use client';

import { useCallback, useRef, useState } from 'react';
import { APPOINTMENT_STATUS } from '@shared/constants.js';
import { formatDateLong, formatTime } from '@shared/format.js';
import { ApiError, apiPatch } from '@/lib/api';
import { useAdmin } from '@/components/admin/AdminContext';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { firstName } from './appointmentUtils';

function successMessage(appointment, action) {
  const name = firstName(appointment.clientName);
  if (action === 'complete') return `Asistencia registrada${name ? ` para ${name}` : ''}.`;
  if (action === 'reopen') return 'Asistencia quitada. La cita vuelve a estar pendiente.';
  if (appointment.kind === 'block') return 'Horario liberado.';
  return 'Cita cancelada. El horario quedó libre.';
}

/**
 * «Asistió», «Cancelar» and «Quitar asistencia» for one appointment at a time.
 * onChanged(updatedAppointment | null, id) runs after every attempt that changed (or
 * revealed a change in) the server state; null means the appointment is gone or changed.
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
        toast.success(successMessage(appointment, action));
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
      const attended = appointment.status === APPOINTMENT_STATUS.COMPLETED;
      const accepted = await confirm({
        title: '¿Cancelar esta cita?',
        message:
          `${appointment.clientName} · ${appointment.serviceName} · ${formatDateLong(appointment.date)}, ${formatTime(appointment.timeSlot)}. El horario quedará libre.` +
          (attended ? ' Estaba marcada como atendida: la asistencia se quita.' : ''),
        confirmLabel: 'Cancelar cita',
        cancelLabel: 'Volver',
        tone: 'danger',
      });
      if (!accepted) return null;
      return run(appointment, 'cancel');
    },
    [confirm, run],
  );

  const reopen = useCallback(
    async (appointment) => {
      if (busyRef.current) return null;
      const accepted = await confirm({
        title: '¿Quitar la asistencia?',
        message: `${appointment.clientName} · ${formatDateLong(appointment.date)}, ${formatTime(appointment.timeSlot)}. La cita vuelve a quedar pendiente, en la misma hora.`,
        confirmLabel: 'Quitar asistencia',
        cancelLabel: 'Volver',
      });
      return accepted ? run(appointment, 'reopen') : null;
    },
    [confirm, run],
  );

  /** Busy action ('complete' | 'cancel' | 'reopen') for this appointment, or null. */
  const busyFor = useCallback((id) => (busy && busy.id === id ? busy.action : null), [busy]);

  return { busy, busyFor, complete, cancel, reopen };
}
