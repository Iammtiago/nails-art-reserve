// One-time superadmin setup. Delete this folder once the account exists.
import { SetupScreen } from '@/components/admin/SetupScreen';

export const metadata = { title: 'Crear superadmin' };

export default function SetupPage() {
  return <SetupScreen />;
}
