import { Inter, Playfair_Display } from 'next/font/google';
import { headers } from 'next/headers';
import { buildThemeTokens, themeTokensToCss } from '../../shared/color.js';
import { Providers } from '@/components/Providers';
import { getPublicSettings, getThemeColors } from '@/lib/server-settings';
import './globals.css';

const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const display = Playfair_Display({ subsets: ['latin'], variable: '--font-display', display: 'swap' });

// Theme and settings come from the database on every request (editable from the panel),
// and the CSP nonce is per request, so the app renders dynamically.
export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const { settings } = await getPublicSettings();
  const name = settings?.businessName || 'Nails Art';
  return {
    title: { default: `${name} · Reserva tu cita`, template: `%s · ${name}` },
    description: `Agenda tu cita en ${name}: manicura, pedicura y más. Elige el día y la hora, y recibe tu ticket con código QR.`,
    applicationName: name,
    metadataBase: new URL(process.env.APP_URL || 'http://localhost:3000'),
    openGraph: {
      title: `${name} · Reserva tu cita`,
      description: `Agenda tu cita en ${name} en menos de un minuto.`,
      type: 'website',
      locale: 'es_VE',
      images: ['/logo.png'],
    },
  };
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#F8F2FE',
};

export default async function RootLayout({ children }) {
  const nonce = (await headers()).get('x-nonce') || undefined;
  const themeCss = themeTokensToCss(buildThemeTokens(await getThemeColors()));

  return (
    <html lang="es" className={`${sans.variable} ${display.variable}`}>
      <head>
        <style id="theme-tokens" nonce={nonce} dangerouslySetInnerHTML={{ __html: themeCss }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
