'use client';

import { Suspense } from 'react';
import { AccountsManager } from '@/components/admin/accounts/AccountsManager';
import { LoadingState } from '@/components/ui/States';

export default function CuentasPage() {
  // useSearchParams (?bienvenida=1) needs a Suspense boundary.
  return (
    <div className="mx-auto w-full max-w-3xl">
      <Suspense fallback={<LoadingState />}>
        <AccountsManager />
      </Suspense>
    </div>
  );
}
