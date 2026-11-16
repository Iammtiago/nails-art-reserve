import { CalendarClock, CalendarDays, Gauge, Lock } from 'lucide-react';
import { formatDuration } from '@shared/format.js';
import { Stat } from '@/components/ui/Controls';
import { percentText } from './calendarUtils';

/** Figures of the visible month or week (null while loading). */
export function CalendarStats({ stats, view }) {
  const scope = view === 'week' ? 'En la semana' : 'En el mes';
  const items = [
    {
      key: 'occupancy',
      label: 'Ocupación',
      value: stats && stats.capacity ? percentText(stats.occupancy) : '—',
      hint: stats ? (stats.capacity ? `${formatDuration(stats.booked)} de ${formatDuration(stats.capacity)}` : 'Sin horas abiertas') : scope,
      icon: Gauge,
      tone: 'brand',
    },
    {
      key: 'appointments',
      label: 'Citas',
      value: stats ? stats.appointments : '—',
      hint: scope,
      icon: CalendarDays,
      tone: 'accent',
    },
    {
      key: 'pending',
      label: 'Pendientes',
      value: stats ? stats.pending : '—',
      hint: 'De hoy en adelante',
      icon: CalendarClock,
      tone: 'brand',
    },
    {
      key: 'blocked',
      label: 'Días bloqueados',
      value: stats ? stats.blocked : '—',
      hint: 'Libres o feriados',
      icon: Lock,
      tone: stats && stats.blocked > 0 ? 'danger' : 'brand',
    },
  ];

  return (
    <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item, index) => (
        <div key={item.key} className="enter min-w-0 [&>*]:h-full" style={{ animationDelay: `${index * 50}ms` }}>
          <Stat label={item.label} value={item.value} hint={item.hint} icon={item.icon} tone={item.tone} />
        </div>
      ))}
    </div>
  );
}
