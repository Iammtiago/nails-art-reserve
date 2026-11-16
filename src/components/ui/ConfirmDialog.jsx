'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';

const ConfirmContext = createContext(null);

/**
 * const confirm = useConfirm();
 * if (await confirm({ title, message, confirmLabel: 'Cancelar cita', tone: 'danger' })) { ... }
 */
export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);
  const resolver = useRef(null);
  const confirmRef = useRef(null);

  const confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        resolver.current = resolve;
        setRequest(options);
      }),
    [],
  );

  const close = (answer) => {
    resolver.current?.(answer);
    resolver.current = null;
    setRequest(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={Boolean(request)}
        onClose={() => close(false)}
        title={request?.title}
        description={request?.message}
        size="sm"
        initialFocusRef={confirmRef}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => close(false)}>
              {request?.cancelLabel || 'Volver'}
            </Button>
            <Button ref={confirmRef} variant={request?.tone === 'danger' ? 'danger' : 'primary'} onClick={() => close(true)}>
              {request?.confirmLabel || 'Confirmar'}
            </Button>
          </div>
        }
      >
        {request?.body || null}
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return ctx;
}
