import { CalendarCheck, CalendarClock, CheckCircle2, CircleX } from 'lucide-react';
import { Stat } from '@/components/ui/Controls';

const ITEMS = [
  { key: 'today', label: 'Hoy', hint: 'Citas del día', icon: CalendarCheck, tone: 'accent' },
  { key: 'upcoming', label: 'Próximas', hint: 'Por atender', icon: CalendarClock, tone: 'brand' },
  { key: 'completed', label: 'Atendidas', hint: 'Asistencias registradas', icon: CheckCircle2, tone: 'success' },
  { key: 'cancelled', label: 'Canceladas', hint: 'Horarios liberados', icon: CircleX, tone: 'danger' },
];

/** KPI strip from the list summary: two columns on phones, four from lg. */
export function AppointmentStats({ summary }) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {ITEMS.map((item, index) => (
        <div key={item.key} className="enter min-w-0 [&>*]:h-full" style={{ animationDelay: `${index * 50}ms` }}>
          <Stat
            label={item.label}
            value={typeof summary?.[item.key] === 'number' ? summary[item.key] : '—'}
            hint={item.hint}
            icon={item.icon}
            tone={item.tone}
            featured={index === 0}
          />
        </div>
      ))}
    </div>
  );
}
