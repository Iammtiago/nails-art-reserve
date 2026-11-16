import { BookingApp } from '@/components/booking/BookingApp';
import { getPublicSettings } from '@/lib/server-settings';

export default async function HomePage() {
  const { settings } = await getPublicSettings();
  return <BookingApp initialSettings={settings} />;
}
