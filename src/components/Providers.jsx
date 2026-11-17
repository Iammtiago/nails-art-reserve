'use client';

import { ConfirmProvider } from '@/components/ui/ConfirmDialog';
import { Spotlight } from '@/components/ui/Spotlight';
import { ToastProvider } from '@/components/ui/Toast';

export function Providers({ children }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <Spotlight />
        {children}
      </ConfirmProvider>
    </ToastProvider>
  );
}
