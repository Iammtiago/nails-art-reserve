'use client';

import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

const TONES = {
  success: { icon: CheckCircle2, className: 'text-success', role: 'status' },
  error: { icon: AlertTriangle, className: 'text-danger', role: 'alert' },
  info: { icon: Info, className: 'text-info', role: 'status' },
};

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const seq = useRef(0);

  const dismiss = useCallback((id) => setItems((list) => list.filter((t) => t.id !== id)), []);

  const push = useCallback(
    (tone, message, { duration = tone === 'error' ? 6000 : 3800 } = {}) => {
      const id = ++seq.current;
      setItems((list) => [...list.slice(-3), { id, tone, message }]);
      setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss],
  );

  const api = useMemo(
    () => ({
      success: (m, o) => push('success', m, o),
      error: (m, o) => push('error', m, o),
      info: (m, o) => push('info', m, o),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:bottom-auto sm:top-4 sm:items-end">
        {items.map((t) => {
          const tone = TONES[t.tone] || TONES.info;
          const Icon = tone.icon;
          return (
            <div key={t.id} role={tone.role} className="glass glass-strong pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl px-4 py-3 text-sm text-ink animate-sheet-up">
              <Icon aria-hidden="true" className={`mt-0.5 h-5 w-5 shrink-0 ${tone.className}`} />
              <p className="flex-1 font-medium leading-snug">{t.message}</p>
              <button type="button" onClick={() => dismiss(t.id)} className="-m-1 rounded-lg p-1 text-ink-3 hover:text-ink" aria-label="Cerrar aviso">
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
