'use client';

import { AlertTriangle, Camera, CameraOff, CheckCircle2, Info, PauseCircle, ScanQrCode } from 'lucide-react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Select } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/Spinner';
import { extractBookingCode } from './bookingCode';

const READER_ID = 'qr-reader';
const REPEAT_WINDOW_MS = 3000;
const NOTICE_MS = 3500;
// html5-qrcode states: 2 = scanning, 3 = paused.
const LIB_SCANNING = 2;
const LIB_PAUSED = 3;

const SCAN_CONFIG = {
  fps: 10,
  qrbox: (w, h) => {
    const s = Math.floor(Math.min(w, h) * 0.7);
    return { width: s, height: s };
  },
  aspectRatio: 1,
};

const MESSAGES = {
  insecure: 'La cámara solo funciona con https.',
  unsupported: 'Este navegador no permite usar la cámara. Escribe el código a mano.',
  denied: 'Permite el acceso a la cámara en tu navegador para escanear.',
  notFound: 'No encontramos ninguna cámara en este dispositivo. Escribe el código a mano.',
  busy: 'La cámara está ocupada por otra aplicación. Ciérrala e inténtalo de nuevo.',
  overconstrained: 'No pudimos usar esa cámara. Elige otra de la lista.',
  generic: 'No pudimos abrir la cámara. Inténtalo de nuevo o escribe el código a mano.',
};

/** html5-qrcode rejects with strings like «Error getting userMedia, error = NotAllowedError: …». */
function cameraErrorMessage(error) {
  const text = typeof error === 'string' ? error : `${error?.name || ''} ${error?.message || ''} ${String(error)}`;
  if (/NotAllowed|Permission|denied|SecurityError/i.test(text)) return MESSAGES.denied;
  if (/Overconstrained/i.test(text)) return MESSAGES.overconstrained;
  if (/NotFound|DevicesNotFound|Requested device not found/i.test(text)) return MESSAGES.notFound;
  if (/NotReadable|TrackStart|Could not start|in use/i.test(text)) return MESSAGES.busy;
  if (/secure context/i.test(text)) return MESSAGES.insecure;
  if (/not supported/i.test(text)) return MESSAGES.unsupported;
  return MESSAGES.generic;
}

/** Stops and clears a scanner without ever throwing. */
async function teardown(scanner) {
  if (!scanner) return;
  try {
    const state = typeof scanner.getState === 'function' ? scanner.getState() : null;
    if (scanner.isScanning || state === LIB_SCANNING || state === LIB_PAUSED) await scanner.stop();
  } catch {
    // Already stopped or never started.
  }
  try {
    scanner.clear();
  } catch {
    // Nothing to clear.
  }
}

function CameraStatus({ status }) {
  if (status === 'scanning') {
    return (
      <Badge tone="success">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" aria-hidden="true" />
        Buscando código
      </Badge>
    );
  }
  if (status === 'paused') return <Badge tone="brand">En pausa</Badge>;
  if (status === 'starting') return <Badge tone="info">Abriendo…</Badge>;
  return null;
}

/** Decorative frame that matches the 70% scan box. */
function ScanFrame() {
  const corner = 'absolute h-9 w-9 border-white';
  return (
    <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center" aria-hidden="true">
      <div className="relative aspect-square w-[70%] rounded-3xl shadow-[0_0_0_100vmax_rgb(var(--color-text-rgb)/0.38)]">
        <span className={`${corner} left-0 top-0 rounded-tl-3xl border-l-4 border-t-4`} />
        <span className={`${corner} right-0 top-0 rounded-tr-3xl border-r-4 border-t-4`} />
        <span className={`${corner} bottom-0 left-0 rounded-bl-3xl border-b-4 border-l-4`} />
        <span className={`${corner} bottom-0 right-0 rounded-br-3xl border-b-4 border-r-4`} />
        <span className="absolute inset-x-6 top-1/2 h-0.5 -translate-y-1/2 animate-pulse rounded-full bg-secondary shadow-[0_0_12px_2px_rgb(var(--color-secondary-rgb)/0.8)]" />
      </div>
    </div>
  );
}

function IdleOverlay({ starting }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-secondary-soft px-6 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-surface/80 text-primary-ink shadow-glass">
        {starting ? <Spinner className="h-7 w-7" /> : <ScanQrCode aria-hidden="true" className="h-8 w-8" />}
      </div>
      <p className="max-w-[16rem] text-sm font-medium text-ink-2">
        {starting ? 'Abriendo la cámara…' : 'Activa la cámara y apunta al QR del ticket.'}
      </p>
    </div>
  );
}

function PausedOverlay({ reason }) {
  const decoded = reason === 'decoded';
  const Icon = decoded ? CheckCircle2 : PauseCircle;
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-[rgb(var(--color-text-rgb)/0.55)] px-6 text-center text-white">
      <Icon aria-hidden="true" className="h-12 w-12" />
      <p className="font-display text-xl font-semibold">{decoded ? 'Código leído' : 'Cámara en pausa'}</p>
      <p className="max-w-[16rem] text-sm text-white/90">Pulsa «Escanear otro» para seguir.</p>
    </div>
  );
}

/**
 * QR camera (html5-qrcode, loaded on demand). Calls onCode(code) once per read and pauses.
 * Ref: { resume(): boolean, pause(): void, isActive(): boolean }
 */
export const CameraScanner = forwardRef(function CameraScanner({ onCode, onActiveChange, style }, ref) {
  const [status, setStatus] = useState('idle'); // idle | starting | scanning | paused | stopping
  const [pausedReason, setPausedReason] = useState('decoded');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cameras, setCameras] = useState([]);
  const [cameraId, setCameraId] = useState('');

  const scannerRef = useRef(null);
  const pendingRef = useRef(null);
  const mountedRef = useRef(false);
  const statusRef = useRef('idle');
  const camerasLoadedRef = useRef(false);
  const lastCodeRef = useRef({ code: '', at: 0 });
  const lastNoticeRef = useRef(0);
  const noticeTimerRef = useRef(null);
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;
  const onActiveRef = useRef(onActiveChange);
  onActiveRef.current = onActiveChange;

  const updateStatus = useCallback((next) => {
    statusRef.current = next;
    if (!mountedRef.current) return;
    setStatus(next);
    onActiveRef.current?.(next === 'scanning' || next === 'paused');
  }, []);

  const showNotice = useCallback((message) => {
    if (!mountedRef.current) return;
    setNotice(message);
    clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => {
      if (mountedRef.current) setNotice('');
    }, NOTICE_MS);
  }, []);

  const handleDecoded = useCallback(
    (text) => {
      if (statusRef.current !== 'scanning') return;
      const now = Date.now();
      const code = extractBookingCode(text);
      if (!code) {
        if (now - lastNoticeRef.current > NOTICE_MS) {
          lastNoticeRef.current = now;
          showNotice('Ese QR no corresponde a una cita.');
        }
        return;
      }
      const last = lastCodeRef.current;
      if (last.code === code && now - last.at < REPEAT_WINDOW_MS) return;
      lastCodeRef.current = { code, at: now };
      try {
        scannerRef.current?.pause(true);
      } catch {
        // The scanner may have just stopped; the read is still valid.
      }
      setPausedReason('decoded');
      updateStatus('paused');
      try {
        navigator.vibrate?.(60);
      } catch {
        // Vibration is optional.
      }
      onCodeRef.current?.(code);
    },
    [showNotice, updateStatus],
  );

  const start = useCallback(
    async (deviceId) => {
      if (pendingRef.current) return;
      setError('');
      setNotice('');
      if (!window.isSecureContext) {
        setError(MESSAGES.insecure);
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(MESSAGES.unsupported);
        return;
      }
      updateStatus('starting');

      const run = (async () => {
        let scanner = null;
        try {
          const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
          if (!mountedRef.current) return;
          if (!camerasLoadedRef.current) {
            const list = await Html5Qrcode.getCameras();
            if (!mountedRef.current) return;
            if (!list.length) {
              const missing = new Error('No camera');
              missing.name = 'NotFoundError';
              throw missing;
            }
            camerasLoadedRef.current = true;
            setCameras(list);
          }
          scanner = new Html5Qrcode(READER_ID, { verbose: false, formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE] });
          scannerRef.current = scanner;
          await scanner.start(deviceId ? deviceId : { facingMode: 'environment' }, SCAN_CONFIG, handleDecoded, () => {});
          if (!mountedRef.current) {
            await teardown(scanner);
            return;
          }
          updateStatus('scanning');
        } catch (err) {
          if (scanner) {
            await teardown(scanner);
            if (scannerRef.current === scanner) scannerRef.current = null;
          }
          if (!mountedRef.current) return;
          updateStatus('idle');
          setError(cameraErrorMessage(err));
        }
      })();

      pendingRef.current = run;
      try {
        await run;
      } finally {
        if (pendingRef.current === run) pendingRef.current = null;
      }
    },
    [handleDecoded, updateStatus],
  );

  const stop = useCallback(async () => {
    if (pendingRef.current) await pendingRef.current;
    const scanner = scannerRef.current;
    scannerRef.current = null;
    updateStatus('stopping');
    await teardown(scanner);
    updateStatus('idle');
  }, [updateStatus]);

  const resume = useCallback(() => {
    if (statusRef.current !== 'paused') return false;
    const scanner = scannerRef.current;
    if (!scanner) return false;
    // Same code right after resuming is ignored for a moment, so the ticket can move away.
    lastCodeRef.current = { ...lastCodeRef.current, at: Date.now() };
    try {
      scanner.resume();
      updateStatus('scanning');
    } catch {
      // The library lost its paused state: restart the camera cleanly.
      scannerRef.current = null;
      teardown(scanner).then(() => {
        if (mountedRef.current) start(cameraId);
      });
    }
    return true;
  }, [cameraId, start, updateStatus]);

  const pause = useCallback(() => {
    if (statusRef.current !== 'scanning') return;
    try {
      scannerRef.current?.pause(true);
    } catch {
      return;
    }
    setPausedReason('manual');
    updateStatus('paused');
  }, [updateStatus]);

  useImperativeHandle(
    ref,
    () => ({
      resume,
      pause,
      isActive: () => statusRef.current === 'scanning' || statusRef.current === 'paused',
    }),
    [resume, pause],
  );

  // Release the camera when leaving the page, even if a start is still in flight.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimeout(noticeTimerRef.current);
      const pending = pendingRef.current;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      (async () => {
        if (pending) await pending;
        await teardown(scanner);
      })();
    };
  }, []);

  const switchCamera = async (id) => {
    setCameraId(id);
    if (statusRef.current === 'scanning' || statusRef.current === 'paused') {
      await stop();
      await start(id);
    }
  };

  const active = status === 'scanning' || status === 'paused' || status === 'stopping';

  return (
    <section className="glass enter p-4 sm:p-5" aria-labelledby="camara-titulo" style={style}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary-soft text-primary-ink">
            <Camera aria-hidden="true" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 id="camara-titulo" className="font-display text-lg font-semibold leading-tight">
              Con la cámara
            </h2>
            <p className="text-sm text-ink-2">Apunta al QR del ticket.</p>
          </div>
        </div>
        <CameraStatus status={status} />
      </div>

      <div className="relative mx-auto aspect-square w-full max-w-[420px] overflow-hidden rounded-2xl bg-ink">
        {/* html5-qrcode owns this node's children; React never renders inside it. */}
        <div id={READER_ID} className="h-full w-full [&>div]:!hidden [&_video]:!h-full [&_video]:!w-full [&_video]:object-cover" />
        {status === 'scanning' ? <ScanFrame /> : null}
        {status === 'paused' ? <PausedOverlay reason={pausedReason} /> : null}
        {status === 'idle' || status === 'starting' ? <IdleOverlay starting={status === 'starting'} /> : null}
      </div>

      <div className="mx-auto mt-4 w-full max-w-[420px] space-y-3">
        {error ? (
          <p className="flex items-start gap-2 rounded-xl bg-danger-soft px-3 py-2.5 text-sm font-medium text-danger" role="alert">
            <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        ) : null}
        <p
          className={`flex items-start gap-2 rounded-xl bg-info-soft px-3 py-2.5 text-sm font-medium text-info ${notice ? '' : 'sr-only'}`}
          aria-live="polite"
        >
          {notice ? <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" /> : null}
          {notice}
        </p>

        {cameras.length > 1 ? (
          <Field label="Cámara">
            {(p) => (
              <Select {...p} value={cameraId} onChange={(event) => switchCamera(event.target.value)} disabled={status === 'starting' || status === 'stopping'}>
                <option value="">Trasera (automática)</option>
                {cameras.map((camera, index) => (
                  <option key={camera.id} value={camera.id}>
                    {camera.label || `Cámara ${index + 1}`}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : null}

        {active ? (
          <Button variant="secondary" icon={CameraOff} block loading={status === 'stopping'} onClick={stop}>
            Detener cámara
          </Button>
        ) : (
          <Button icon={Camera} block loading={status === 'starting'} onClick={() => start(cameraId)}>
            Activar cámara
          </Button>
        )}
      </div>
    </section>
  );
});
