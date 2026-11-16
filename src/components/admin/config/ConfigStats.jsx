'use client';

import { CalendarDays, CalendarRange, Contrast, Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import { paletteReport } from '@shared/color.js';
import { formatDuration, pluralize } from '@shared/format.js';
import { dayCapacityMinutes } from '@shared/schedule.js';
import { Stat } from '@/components/ui/Controls';

/** Live figures of the draft: open days, weekly hours, active services, window and contrast. */
export function ConfigStats({ draft, previewColors }) {
  const figures = useMemo(() => {
    const openDays = draft.workingHours.filter((d) => d.isOpen).length;
    const weeklyMinutes = draft.workingHours.reduce((sum, d) => sum + dayCapacityMinutes(d), 0);
    const activeServices = draft.services.filter((s) => s.isActive).length;
    const windowDays = Number(draft.booking.windowDays);
    const report = paletteReport(previewColors);
    const passing = report.filter((p) => p.passes).length;
    return { openDays, weeklyMinutes, activeServices, windowDays, passing, pairs: report.length };
  }, [draft.workingHours, draft.services, draft.booking.windowDays, previewColors]);

  const stats = [
    {
      label: 'Días abiertos',
      value: `${figures.openDays} de 7`,
      hint: figures.weeklyMinutes ? `${formatDuration(figures.weeklyMinutes)} a la semana` : 'Sin horario de atención',
      icon: CalendarDays,
      tone: figures.openDays ? 'brand' : 'danger',
    },
    {
      label: 'Servicios activos',
      value: figures.activeServices,
      hint: `de ${pluralize(draft.services.length, 'servicio', 'servicios')}`,
      icon: Sparkles,
      tone: figures.activeServices ? 'accent' : 'danger',
    },
    {
      label: 'Reservas hasta',
      value: Number.isInteger(figures.windowDays) && figures.windowDays > 0 ? pluralize(figures.windowDays, 'día', 'días') : '—',
      hint: 'de anticipación',
      icon: CalendarRange,
      tone: 'brand',
    },
    {
      label: 'Contraste AA',
      value: `${figures.passing} de ${figures.pairs}`,
      hint: figures.passing === figures.pairs ? 'Todo se lee bien' : 'Revisa los colores',
      icon: Contrast,
      tone: figures.passing === figures.pairs ? 'success' : 'danger',
    },
  ];

  return (
    <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <div key={stat.label} className="enter" style={{ animationDelay: `${index * 50}ms` }}>
          <Stat label={stat.label} value={stat.value} hint={stat.hint} icon={stat.icon} tone={stat.tone} />
        </div>
      ))}
    </div>
  );
}
