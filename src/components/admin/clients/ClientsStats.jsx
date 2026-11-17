'use client';

import { Repeat, Users } from 'lucide-react';
import { Stat } from '@/components/ui/Controls';
import { Skeleton } from '@/components/ui/States';
import { staggerDelay } from './clientUtils';

function StatSkeleton() {
  return (
    <div className="glass flex items-center gap-3 p-4" aria-hidden="true">
      <Skeleton className="h-11 w-11 shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-6 w-12" />
      </div>
    </div>
  );
}

/** Directory-wide figures (they do not change with the search). `unavailable` shows dashes after an error. */
export function ClientsStats({ summary, unavailable = false }) {
  const stats = [
    { label: 'Clientas', value: summary?.total, hint: 'En tu directorio', icon: Users, tone: 'brand' },
    { label: 'Recurrentes', value: summary?.recurring, hint: '2 o más visitas', icon: Repeat, tone: 'success' },
  ];

  return (
    <div className="mb-4 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
      {stats.map((stat, index) => (
        <div key={stat.label} className="enter" style={staggerDelay(index, 50)}>
          {summary || unavailable ? (
            <Stat label={stat.label} value={summary ? (stat.value ?? 0) : '—'} hint={stat.hint} icon={stat.icon} tone={stat.tone} featured={index === 0} />
          ) : (
            <StatSkeleton />
          )}
        </div>
      ))}
    </div>
  );
}
