import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="relative grid min-h-dvh place-items-center px-4">
      <div className="aurora" aria-hidden="true">
        <span />
      </div>
      <div className="glass glass-strong max-w-md p-8 text-center">
        <p className="eyebrow">Error 404</p>
        <h1 className="mt-2 font-display text-3xl font-semibold">Esta página no existe</h1>
        <p className="mt-2 text-ink-2">Puede que el enlace esté mal escrito o que la página se haya movido.</p>
        <Link href="/" className="btn btn-primary btn-lg mt-6">
          Reservar una cita
        </Link>
      </div>
    </main>
  );
}
