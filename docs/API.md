# API REST · Nails Art

Express 5 montado en `/api` (dentro de Next en `src/pages/api/[...path].js`; suelto con `npm run api`).

## Convenciones

- JSON en ambos sentidos. Fechas civiles `YYYY-MM-DD`, horas locales `HH:mm` (zona `America/Caracas`), instantes en ISO UTC.
- Teléfonos guardados como dígitos con código de país (`584141234567`). Las entradas aceptan `0414 123 4567`, `+58 414…`, `+57 300…`.
- **CSRF:** toda petición que no sea `GET` lleva la cabecera `X-Requested-With: nails-art` (si falta → `403`).
- **Sesión del panel:** cookie `na_admin` (`HttpOnly`, `SameSite=Lax`, `Secure` en producción, 12 h).
- **Errores:** `{ error, code?, details?: [{ path, message }] }`. Códigos HTTP: `400` JSON inválido o id inválido, `401` sin sesión, `403` CSRF o clave de instalación incorrecta, `404`, `409` conflicto, `410` instalación ya hecha, `413` cuerpo demasiado grande, `422` validación o regla de negocio, `429` demasiados intentos, `503` servicio o configuración no disponible.
- Listas paginadas: `?page&limit` → `{ items, total, page, pages, limit, summary }`.

## Públicas

### `GET /api/health`
`{ ok: true }` (no toca la base).

### `GET /api/settings`
```json
{ "settings": {
  "businessName": "Nails Art", "phone": "584147368595",
  "instagramUrl": "https://www.instagram.com/nailsart.sc", "logoUrl": "/logo.png",
  "timezone": "America/Caracas",
  "themeColors": { "primary": "#4B1C71", "secondary": "#D3B0F4", "accent": "#8E3FC7", "background": "#F8F2FE", "text": "#2A0F40" },
  "workingHours": [{ "dayOfWeek": 1, "isOpen": true, "openTime": "08:30", "closeTime": "19:00", "breakStart": "12:30", "breakEnd": "14:00", "slotDurationMinutes": 60 }],
  "services": [{ "key": "manicura", "name": "Manicura", "durationMinutes": 60 }],
  "booking": { "windowDays": 30, "minLeadMinutes": 60, "maxActivePerPhone": 3 },
  "blockedDates": [{ "date": "2026-12-24" }],
  "now": { "date": "2026-11-16", "minutes": 600, "time": "10:00" }
} }
```
`services` solo trae los activos. `now` es la hora del negocio (no la del navegador).

### `GET /api/appointments/days?service=manicura`
Estado de cada fecha de la ventana de reservas para ese servicio.
```json
{ "days": [{ "date": "2026-11-16", "status": "available", "freeSlots": 7 }],
  "from": "2026-11-16", "to": "2026-12-16", "now": {…}, "service": { "key", "name", "durationMinutes" } }
```
`status`: `available` · `full` · `closed` · `blocked` · `past` · `out_of_window`.

### `GET /api/appointments/availability?date=YYYY-MM-DD&service=manicura`
```json
{ "date": "2026-11-21", "bookable": true, "reason": null, "reasonLabel": null,
  "slots": [{ "time": "08:30", "endTime": "09:30", "available": true }],
  "service": {…}, "now": {…} }
```
Las horas pasadas (o dentro de la antelación mínima) no aparecen; las ocupadas vienen con `available: false`.
`reason`: `full` · `closed` · `blocked` · `past` · `out_of_window`.

### `POST /api/appointments`
Cuerpo: `{ serviceKey, date, timeSlot, clientName, clientPhone }` (+ `website` vacío: campo trampa).
`201 { appointment: { id, clientName, clientPhone, serviceKey, serviceName, durationMinutes, date, timeSlot, endTime, bookingCode, qrDataUrl, status, createdAt } }`
Errores de negocio (`code`): `409 SLOT_TAKEN`, `422 INVALID_TIME`, `422 DATE_UNAVAILABLE`, `422 SERVICE_UNAVAILABLE`, `422 MAX_ACTIVE_REACHED` (3 citas activas por teléfono), `422 VALIDATION`, `429 RATE_LIMITED` (12 reservas/hora por IP).

### `GET /api/appointments/by-phone/:phone`
Citas confirmadas que aún no empiezan: `{ appointments: [{ id, clientFirstName, serviceName, date, timeSlot, endTime, status }] }`. Nunca devuelve código ni QR. Límite: 30 búsquedas cada 10 min por IP.

### `PATCH /api/appointments/:id/cancel`
Cuerpo `{ phone }`; debe coincidir con el de la cita. `200 { appointment }`. Errores: `404 APPOINTMENT_NOT_FOUND`, `409 NOT_ACTIVE`, `422 ALREADY_STARTED`.

## Acceso al panel

### `GET /api/auth/status`
`{ authenticated, admin: { id, username, role } | null }`

El alta web (`POST /api/auth/setup`) se retiró el 2026-11-16. Cuentas nuevas: `POST /api/admin/accounts` o `npm run admin:create`. Contraseñas: mínimo 6 caracteres.

### `POST /api/auth/login`
`{ username, password }` → `{ admin }` + cookie. `401 BAD_CREDENTIALS` (mismo mensaje exista o no el usuario), `429` tras 5 fallos en 15 min por IP.

### `POST /api/auth/logout` · `GET /api/auth/session`

## Panel (requieren sesión)

### `PUT /api/settings`
Actualización parcial con cualquiera de: `businessName`, `phone`, `instagramUrl`, `logoUrl` (ruta `/…`, URL `https://…` o `data:image/png|jpeg|webp;base64,…` hasta ~2 MB), `themeColors` (5 hex), `workingHours` (7 días), `services`, `booking` (`windowDays`, `minLeadMinutes`, `maxActivePerPhone`). Responde `{ settings }` completo.

### `GET /api/admin/settings`
Configuración completa (incluye servicios inactivos y motivos de días bloqueados).

### `POST /api/appointments/verify`
`{ code, markAttended? }` → `{ appointment, attended, warnings: string[], canMarkAttended, now }`. `404 CODE_NOT_FOUND`; con `markAttended` sobre una cita ya atendida o cancelada → `409`.

### `GET /api/admin/appointments?view=&date=&q=&page=&limit=`
`view`: `today` · `upcoming` (por defecto) · `completed` · `cancelled` · `all`. `q` busca por nombre, teléfono o código.
Ítems: `{ id, clientName, clientPhone, serviceKey, serviceName, durationMinutes, date, timeSlot, endTime, bookingCode, status, cancelledAt, cancelledBy, completedAt, createdAt }`.
`summary: { today, upcoming, completed, cancelled }`. Incluye `now` (fecha y hora del salón, mismo formato que en `GET /api/settings`) para que el panel sepa qué es «hoy».

### `PATCH /api/admin/appointments/:id/complete` · `PATCH /api/admin/appointments/:id/cancel`
`{ appointment }`. `409` si la cita no está confirmada.

### `GET /api/admin/appointments/:id/ticket`
Ticket de una cita con su QR (`{ ticket: { …, qrDataUrl, qrText } }`), para volver a descargarlo desde el detalle de la cita en Citas o Calendario. Los horarios ocupados responden `404`.

### `POST /api/admin/appointments` (cita manual)
`{ serviceKey, date, timeSlot, clientName, clientPhone }` → `201 { appointment }` con `qrDataUrl`, `qrText` y `source: 'admin'`. Acepta cualquier hora en tramos de 15 min (también fuera del horario, del rango de reservas y del límite por teléfono). `409 SLOT_TAKEN` si choca, `422 PAST_TIME` si ya pasó.

### `POST /api/admin/time-blocks` (ocupar horario)
`{ date, start, end, reason? }` → `201 { block }` (`kind: 'block'`). Las clientas no pueden reservar ese rango. No cuenta en Citas ni en sus totales; sí en el calendario (`blockedMinutes`, ítems con `kind`). `409 TIME_TAKEN` si choca. Se libera con `PATCH /api/admin/appointments/:id/cancel`.

### Cuentas del panel
Todas las cuentas son `superadmin` (acceso completo). Máximo 5.

- `GET /api/admin/accounts` → `{ items: [{ id, username, role, createdAt, lastLoginAt, isSelf }], max }`.
- `POST /api/admin/accounts` `{ username, password, passwordConfirm }` → `201 { account }`. `409 USERNAME_TAKEN` (con `details` en `username`), `409 ACCOUNTS_FULL`.
- `PATCH /api/admin/accounts/:id/password` `{ password, passwordConfirm, currentPassword? }` → `{ account }`. Para tu propia cuenta `currentPassword` es obligatoria (`422 CURRENT_PASSWORD_INVALID`) y la cookie se renueva; para otra cuenta no se pide y sus sesiones abiertas dejan de valer.
- `DELETE /api/admin/accounts/:id` → `{ ok: true }`. `409 ACCOUNT_SELF` si intentas borrar la tuya; `404 ACCOUNT_NOT_FOUND`.

### Modo superadmin oculto

Se abre con cuatro toques rápidos sobre el título de cualquier sección del panel. Eleva la sesión actual durante 15 minutos con la cookie `HttpOnly` `na_super`, ligada a esa cuenta; cerrar sesión también la borra.

- `GET /api/admin/super` → `{ active, expiresAt }`.
- `POST /api/admin/super/unlock` `{ key }` → `{ active: true, expiresAt }`. La clave es `1111`, fija por orden de Tiago, y solo se comprueba en el servidor. Clave mala: `401 BAD_SUPER_KEY`. Tras 5 fallos en 15 minutos (por cuenta e IP): `429 RATE_LIMITED`.
- `POST /api/admin/super/lock` → `{ active: false }`.
- `DELETE /api/admin/super/clients/:id` → `{ deleted: { clients: 1, appointments: n } }`. Borra la clienta y todas las citas con su teléfono.
- `DELETE /api/admin/super/appointments/:id` → `{ deleted: { appointments: 1 } }`. Borra una cita o un horario ocupado y lo descuenta de los contadores de la clienta.
- Sin el modo activo, los `DELETE` responden `403 SUPER_REQUIRED`. Cada borrado queda en la colección `purgelogs` con la cuenta, la hora y una copia de lo borrado.

### `GET /api/admin/clients?q=&page=&limit=`
Ítems: `{ id, name, phone, totalAppointments, completedAppointments, lastAppointmentDate, lastVisitDate, createdAt }`. `summary: { total, recurring }` (recurrentes = 2+ visitas).

### `PATCH /api/admin/clients/:id`
`{ name, phone }` → `{ client }`. Sus citas pasan al nombre y teléfono nuevos (con ese número las ve y las cancela). `409 PHONE_TAKEN` (con `details` en `phone`) si el número es de otra clienta, `404 CLIENT_NOT_FOUND`.

### `GET /api/admin/calendar?from=&to=` (máximo 62 días)
```json
{ "from", "to", "now", "workingHours",
  "days": [{ "date", "dayOfWeek", "isOpen", "blocked", "blockReason", "isPast", "isToday",
             "capacityMinutes", "bookedMinutes", "appointmentsCount", "pendingCount", "occupancy" }],
  "appointments": [{ "id", "clientName", "clientPhone", "serviceName", "durationMinutes", "date", "timeSlot", "endTime", "status", "bookingCode" }] }
```
Las citas canceladas no se incluyen.

### `POST /api/admin/blocked-dates` · `DELETE /api/admin/blocked-dates/:date`
Cuerpo `{ date, reason? }` → `201 { blockedDates, affectedAppointments }`. No se puede bloquear un día pasado (`422`). Bloquear no cancela citas existentes.
