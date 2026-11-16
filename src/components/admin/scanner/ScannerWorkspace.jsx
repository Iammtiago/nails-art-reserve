'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { STATUS_LABELS } from '@shared/constants.js';
import { ApiError, apiPost } from '@/lib/api';
import { useAdmin } from '@/components/admin/AdminContext';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { PageHeader } from '@/components/ui/Controls';
import { useToast } from '@/components/ui/Toast';
import { CameraScanner } from './CameraScanner';
import { CodeInput } from './CodeInput';
import { RecentVerifications } from './RecentVerifications';
import { VerificationResult } from './VerificationResult';
import { isBookingCode, sanitizeCodeInput } from './bookingCode';

const HISTORY_SIZE = 5;
const IDLE = { status: 'idle' };

// Read at call time: the two-column layout starts at lg (1024 px).
function isTwoColumns() {
  return window.matchMedia('(min-width: 1024px)').matches;
}

function scrollBehavior() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

function announcementFor(verification) {
  switch (verification.status) {
    case 'loading':
      return `Verificando el código ${verification.code}.`;
    case 'not_found':
      return 'No encontramos ninguna cita con ese código.';
    case 'error':
      return 'No se pudo verificar el código.';
    case 'found': {
      const { appointment, attended } = verification.data;
      if (attended) return `Asistencia registrada para ${appointment.clientName}.`;
      return `Cita de ${appointment.clientName}: ${STATUS_LABELS[appointment.status] || appointment.status}.`;
    }
    default:
      return '';
  }
}

/** Scanner page: camera + manual code on the left, verification on the right (stacked on mobile). */
export function ScannerWorkspace() {
  const { settings, handleError } = useAdmin();
  const toast = useToast();
  const confirm = useConfirm();
  const searchParams = useSearchParams();

  const [verification, setVerification] = useState(IDLE);
  const [code, setCode] = useState('');
  const [marking, setMarking] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [history, setHistory] = useState([]);

  const handleErrorRef = useRef(handleError);
  handleErrorRef.current = handleError;
  const verificationRef = useRef(verification);
  verificationRef.current = verification;
  const requestRef = useRef(0);
  const autoVerifiedRef = useRef(false);
  const cameraRef = useRef(null);
  const codeInputRef = useRef(null);
  const inputsRef = useRef(null);
  const resultRef = useRef(null);

  const remember = useCallback((entry) => {
    setHistory((list) => [entry, ...list.filter((item) => item.code !== entry.code)].slice(0, HISTORY_SIZE));
  }, []);

  // On mobile the result sits below the inputs: bring it into view.
  const revealResult = useCallback(() => {
    if (isTwoColumns()) return;
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ block: 'start', behavior: scrollBehavior() }));
  }, []);

  const verify = useCallback(
    async (rawCode) => {
      const target = String(rawCode || '').trim().toUpperCase();
      if (!isBookingCode(target)) return;
      const current = verificationRef.current;
      if (current.status === 'loading' && current.code === target) return;

      const id = ++requestRef.current;
      // One result at a time: a live camera waits until «Escanear otro».
      cameraRef.current?.pause();
      setVerification({ status: 'loading', code: target });
      revealResult();
      try {
        const data = await apiPost('/api/appointments/verify', { code: target });
        if (id !== requestRef.current) return;
        setVerification({ status: 'found', code: target, data });
        remember({ code: target, name: data.appointment.clientName, status: data.appointment.status });
      } catch (error) {
        if (id !== requestRef.current) return;
        if (error instanceof ApiError && error.status === 404) {
          setVerification({ status: 'not_found', code: target });
          remember({ code: target, name: '', status: 'not_found' });
          return;
        }
        handleErrorRef.current(error);
        setVerification({ status: 'error', code: target, error });
      }
    },
    [remember, revealResult],
  );

  // ?codigo= from a ticket QR opened with the phone camera: verify once, then clean the URL.
  const codeParam = searchParams.get('codigo');
  useEffect(() => {
    if (autoVerifiedRef.current || codeParam === null) return;
    autoVerifiedRef.current = true;
    const { code: clean } = sanitizeCodeInput(codeParam.trim());
    setCode(clean);
    if (isBookingCode(clean)) verify(clean);
    window.history.replaceState(null, '', window.location.pathname);
  }, [codeParam, verify]);

  const handleCameraCode = useCallback(
    (scanned) => {
      setCode(scanned);
      verify(scanned);
    },
    [verify],
  );

  const selectFromHistory = (picked) => {
    setCode(picked);
    verify(picked);
  };

  const markAttended = async () => {
    if (verification.status !== 'found' || marking) return;
    const { appointment, now } = verification.data;
    if (appointment.date !== now?.date) {
      const ok = await confirm({
        title: 'Esta cita no es para hoy',
        message: '¿Marcar asistencia de todas formas?',
        confirmLabel: 'Marcar asistencia',
      });
      if (!ok) return;
    }
    const id = requestRef.current;
    const target = appointment.bookingCode;
    setMarking(true);
    try {
      const data = await apiPost('/api/appointments/verify', { code: target, markAttended: true });
      toast.success('Asistencia registrada');
      remember({ code: target, name: data.appointment.clientName, status: data.appointment.status });
      if (id === requestRef.current) setVerification({ status: 'found', code: target, data });
    } catch (error) {
      handleErrorRef.current(error);
      // Someone else changed it meanwhile (409): show its current state.
      if (error instanceof ApiError && error.status === 409 && id === requestRef.current) verify(target);
    } finally {
      setMarking(false);
    }
  };

  const reset = () => {
    requestRef.current += 1;
    setVerification(IDLE);
    setCode('');
    const camera = cameraRef.current;
    const resumed = camera?.resume() || false;
    if (!isTwoColumns()) inputsRef.current?.scrollIntoView({ block: 'start', behavior: scrollBehavior() });
    if (!resumed && !camera?.isActive()) codeInputRef.current?.focus({ preventScroll: true });
  };

  const retry = () => {
    if (verification.code) verify(verification.code);
  };

  const businessName = settings?.businessName || 'Nails Art';
  const resetLabel = cameraActive ? 'Escanear otro' : 'Verificar otro código';

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="enter">
        <PageHeader eyebrow="Asistencia" title="Escanear código" description="Valida la cita con la cámara o escribiendo el código de 6 caracteres." />
      </div>
      <p className="sr-only" aria-live="polite">
        {announcementFor(verification)}
      </p>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start lg:gap-6">
        <div ref={inputsRef} className="min-w-0 scroll-mt-24 space-y-4">
          <CameraScanner ref={cameraRef} onCode={handleCameraCode} onActiveChange={setCameraActive} style={{ animationDelay: '60ms' }} />
          <CodeInput
            ref={codeInputRef}
            value={code}
            onChange={setCode}
            onSubmit={verify}
            busy={verification.status === 'loading'}
            style={{ animationDelay: '120ms' }}
          />
        </div>

        <div ref={resultRef} className="min-w-0 scroll-mt-24 space-y-4 lg:scroll-mt-8">
          <VerificationResult
            key={`${verification.status}-${verification.code || ''}-${verification.data?.attended ? 'a' : ''}`}
            verification={verification}
            businessName={businessName}
            marking={marking}
            onMarkAttended={markAttended}
            onRetry={retry}
            onReset={reset}
            resetLabel={resetLabel}
          />
          <RecentVerifications items={history} onSelect={selectFromHistory} disabled={marking} />
        </div>
      </div>
    </div>
  );
}
