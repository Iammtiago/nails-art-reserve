import { OCCUPANCY_BAR_CLASSES, occupancyLevel } from './calendarUtils';

/**
 * Thin decorative bar: width = occupancy, color by level (< 50 % accent, < 85 % primary, else danger).
 * Built from spans so it can sit inside buttons (month cells).
 */
export function OccupancyBar({ percent, className = '' }) {
  const width = Math.max(0, Math.min(100, percent));
  return (
    <span className={`block h-1.5 w-full overflow-hidden rounded-full bg-primary-soft ${className}`} aria-hidden="true">
      <span className={`block h-full rounded-full transition-[width] duration-500 ${OCCUPANCY_BAR_CLASSES[occupancyLevel(percent)]}`} style={{ width: `${width}%` }} />
    </span>
  );
}
