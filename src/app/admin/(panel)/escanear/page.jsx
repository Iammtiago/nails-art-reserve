'use client';

import { Suspense } from 'react';
import { ScannerWorkspace } from '@/components/admin/scanner/ScannerWorkspace';
import { LoadingState } from '@/components/ui/States';

export default function EscanearPage() {
  // useSearchParams (?codigo=) needs a Suspense boundary.
  return (
    <Suspense fallback={<LoadingState />}>
      <ScannerWorkspace />
    </Suspense>
  );
}
