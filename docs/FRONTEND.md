# Guía de interfaz (contrato para construir pantallas)

## Reglas

- **JavaScript + JSX**, sin TypeScript. Componentes de cliente con `'use client'` arriba.
- **Nunca definas un componente dentro de otro** (pierde foco y estado). Todo componente a nivel de módulo.
- **Colores solo con tokens** de Tailwind (`bg-primary`, `text-primary-on`, `bg-secondary-soft`, `text-ink`, `text-ink-2`, `text-ink-3`, `border-line`, `bg-surface`, `bg-accent-soft`, `text-accent-ink`, `bg-success-soft text-success`, `bg-danger-soft text-danger`, `bg-warning-soft text-warning`, `bg-info-soft text-info`). Nada de hex sueltos (excepto el canvas del ticket, que lee las variables CSS en tiempo de ejecución).
- Tipografía: `font-display` (Playfair Display) para títulos y cifras; cuerpo con `font-sans` (Inter, por defecto).
- Vidrio: `className="glass"` (tarjetas) o `"glass glass-strong"` (más opaco: modales, barras). Fondo animado del panel ya lo pone `AdminShell`; en el sitio público usa `<div className="aurora" aria-hidden="true"><span /></div>` sin animación.
- **Móvil primero** (360 px) y comprobar a 1280 px. Objetivos táctiles ≥ 44 px. Sin desplazamiento horizontal. Tablas → tarjetas apiladas en móvil.
- Etiqueta visible encima de cada campo (`<Field>`), foco visible, `aria-label` en botones de solo icono.
- Nada de `alert`, `confirm` ni `prompt`: usa `useToast()` y `useConfirm()`.
- Toda carga tiene tres estados: `LoadingState`, `EmptyState`, `ErrorState` (con reintento).
- Textos en español neutro, tuteo cercano y elegante. Botones con la acción («Guardar horario», «Cancelar cita»), no «Aceptar».
- Iconos: `lucide-react`, con `aria-hidden="true"` cuando son decorativos.
- Fechas y horas siempre con `shared/format.js` (`formatDateLong`, `formatDateShort`, `formatDayMonth`, `formatMonth`, `formatTime`, `formatTimeRange`, `formatDuration`). **Nunca** `new Date()` para saber «hoy»: usa `settings.now` o `now` de las respuestas de la API. Para aritmética de fechas civiles usa `shared/time.js` (`addDays`, `addMonths`, `startOfMonth`, `startOfWeek`, `daysInMonth`, `dayOfWeek`, `diffDays`).
- Teléfonos: `formatPhone` de `shared/phone.js`; WhatsApp: `whatsappLink`, `bookingConfirmationText`, `clientContactText` de `shared/whatsapp.js`.
- Movimiento: panel generoso (`enter` = `animate-fade-up`, retraso escalonado en línea con tope de 300 ms), público sobrio. Un elemento que entra con animación arranca a opacidad 0,35, nunca invisible. Respetar «reducir movimiento» (ya global en CSS).
- Importa `shared/` con rutas relativas (`../../../shared/format.js`) o con el alias `@shared/format.js`.

## Kit (`src/components/ui/`)

| Componente | Uso |
|---|---|
| `Button` | `<Button variant="primary|secondary|soft|ghost|danger|whatsapp" size="sm|md|lg" loading icon={Icono} iconRight={Icono} block href?>` |
| `IconButton` | `<IconButton icon={X} label="Cerrar" variant="ghost" size="sm|md" />` |
| `Field`, `Input`, `Select`, `Textarea` | `<Field label hint error required>{(p) => <Input {...p} value onChange />}</Field>` |
| `Modal` | `<Modal open onClose title description size="sm|md|lg" footer={…}>…</Modal>` (hoja inferior en móvil) |
| `useToast()` | `toast.success(msg)`, `toast.error(msg)`, `toast.info(msg)` |
| `useConfirm()` | `await confirm({ title, message, confirmLabel, cancelLabel, tone: 'danger' })` → `true/false` |
| `LoadingState`, `EmptyState`, `ErrorState`, `Skeleton` | Estados de carga |
| `Badge`, `StatusBadge` | `<Badge tone="brand|accent|success|warning|danger|info|neutral">`, `<StatusBadge status="confirmed" />` |
| `Segmented` | `<Segmented options={[{ value, label, count }]} value onChange ariaLabel />` |
| `Toggle` | `<Toggle checked onChange label description />` |
| `Pagination` | `<Pagination page pages total onChange />` |
| `PageHeader` | `<PageHeader eyebrow title description actions />` |
| `Stat` | `<Stat label value hint icon={Icono} tone="brand|success|danger|accent" />` |
| `BrandLogo` | `<BrandLogo src={settings.logoUrl} name size={48} />` |
| `Spinner` | `<Spinner className="h-5 w-5" />` |

## Datos

- Cliente HTTP único: `src/lib/api.js` → `apiGet(path, query, { signal })`, `apiPost(path, body)`, `apiPut`, `apiPatch`, `apiDelete`; error `ApiError` con `status`, `code`, `details`, `fieldErrors()`; `errorMessage(error)`.
- Hooks: `src/lib/hooks.js` → `useAsync(loader(signal), deps)` → `{ data, error, loading, reload({ silent }), setData }`, `useDebouncedValue(v, ms)`, `useInterval(fn, ms, enabled)`, `useMediaQuery(q)`.
- Contrato completo de la API: `docs/API.md`.

## Panel

- Cada sección es `src/app/admin/(panel)/<seccion>/page.jsx` (componente cliente) dentro de `AdminShell`, que ya resuelve el acceso, el menú lateral (escritorio) y la barra inferior (móvil).
- `useAdmin()` (`src/components/admin/AdminContext.jsx`) da `{ admin, settings, reloadSettings, handleError, logout }`. Ante cualquier error de la API llama `handleError(error)`: muestra el aviso y, si es `401`, devuelve al login.
- `settings` es la configuración pública (nombre, teléfono, servicios activos, horarios, `now`), útil para los mensajes de WhatsApp.
- Cada sección con su propia inteligencia: una franja corta de cifras útiles arriba (`Stat`), sin gráficas pesadas.
