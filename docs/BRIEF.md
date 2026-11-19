# Nails Art · Brief de la primera versión

Fecha: 2026-11-16 · Autor: Dev (con Tiago) · Estado: aprobado por Tiago el 2026-11-16 (con el cambio del superadmin del mismo día)

## 1. Negocio y objetivo

**Nails Art** (`@nailsart.sc`) es una manicurista independiente en San Cristóbal, Táchira (Venezuela); no es un salón de belleza (Tiago, 2026-11-19), así que los textos dicen «manicurista», no «salón». Hoy agenda por WhatsApp e Instagram.

Objetivo de la v1: que la clienta reserve sola desde el móvil en menos de un minuto (servicio → día → hora → nombre y teléfono), reciba un ticket con QR y código de 6 caracteres, y que el salón gestione agenda, clientas y asistencia desde un panel.

Lo que debe salir perfecto: **nunca dos citas en el mismo horario** y el ticket QR verificable en el salón.

Datos reales tomados del Instagram público (confirmar):

| Dato | Valor |
|---|---|
| WhatsApp | `+58 414 736 8595` (`584147368595`) |
| Instagram | `https://www.instagram.com/nailsart.sc` |
| Horario | Lunes a sábado 8:30–12:30 y 14:00–19:00 · domingo cerrado |
| Zona horaria | `America/Caracas` (UTC−4) |
| URL pública | `https://nails-art-sc.vercel.app` |

## 2. Tipo, superficies y módulos

Tipo: **reservas y agenda**, un solo negocio (no multi-cliente).

**Dentro de la v1**

- **Portal público `/`** (móvil primero): cabecera con logo, nombre e Instagram; reserva en 4 pasos (Servicio → Fecha y hora → Tus datos → Ticket); botón **Cancelar cita**.
- **Ticket digital**: QR, código de 6 caracteres grande con copiar, resumen (nombre, servicio, fecha, hora), **Guardar en galería** (PNG dibujado en canvas; en móvil abre el menú de compartir para guardarlo en Fotos) y **Confirmar por WhatsApp** al número del salón con el mensaje pedido.
- **Panel `/admin`** con usuario y contraseña y 5 secciones: Configuración, Calendario, Citas, Clientes, Escanear código; más **Cuentas** (2026-11-16).
- **Alta única del superadmin** en `/admin/setup` (decisión de Tiago, 2026-11-16, ajustada esa misma tarde): ninguna credencial pasa por el chat ni por el código. La página queda **abierta sin clave** hasta que exista la primera cuenta; Tiago la crea nada más desplegar, y desde **Cuentas** crea la de la manicurista. Tiago la creó el 2026-11-16 y el alta se retiró del código ese mismo día; contraseñas de 6+ caracteres (pedido de Tiago).
- **Modo superadmin oculto (2026-11-17, regla de Tiago para todas sus plataformas):** cuatro toques al título de cualquier sección → clave `1111` → 15 minutos en los que se pueden eliminar para siempre clientas (con todas sus citas) y citas u horarios ocupados. Validado en el servidor, con límite de intentos y auditoría (`purgelogs`).
- **Landing (2026-11-16):** cabecera fija con Agendar, Cancelar y Llamar; hero con estado abierto/cerrado en vivo y la frase «Arte y color en cada detalle.» seguida de «Tu momento de consentirte comienza aquí.» en cursiva destacada (cambio de Tiago del 2026-11-19, sugerido por Gemini; antes «No existen manos feas, solo uñas sin cita.»); debajo de la reserva: cómo funciona, lo que debes saber (de Configuración), frase destacada, horario, contacto, preguntas frecuentes y llamado final.

**Fuera de la v1** (se propone, no se construye): precios y cobros, recordatorios automáticos, lista de espera, varias manicuristas, archivo `.ics`, cuentas de clienta, tema oscuro.

## 3. Roles

| Rol | Cómo entra | Puede |
|---|---|---|
| Clienta | Sin cuenta | Ver servicios y horarios libres, reservar, ver y cancelar sus citas activas escribiendo su teléfono |
| Superadmin (Tiago y la manicurista) | Tiago crea la suya en `/admin/setup` (una sola vez) y la de la manicurista en Cuentas | Todo el panel: configuración, calendario, citas, clientas, verificación, asistencia y cuentas (crear, nueva contraseña, borrar otras; nunca la propia). Máximo 5 cuentas |

El servidor exige la sesión de administración en todas las rutas del panel, en `PUT /api/settings` y en la verificación de códigos. La interfaz solo oculta.

## 4. Reglas del negocio

**Servicios** (editables en Configuración: nombre, duración, activo)

| Servicio | Duración |
|---|---|
| Manicura | 60 min |
| Pedicura | 60 min |
| Manicura + pedicura | 120 min |

**Agenda**

- Una clienta a la vez (capacidad 1).
- Cada día tiene: abierto o cerrado, hora de apertura y cierre, pausa opcional (almuerzo) y **«Horas cada»** (`slotDurationMinutes`, por defecto 30 desde el 2026-11-19; con 30 la clienta elige 8:30, 9:00, 9:30…). Las horas de inicio salen cada ese paso desde el inicio de cada turno; cada cita ocupa lo que dura su servicio en tramos de 15 min y tapa las horas que pisa; un servicio solo se ofrece si **cabe entero** en el turno sin cruzar la pausa ni chocar con otra cita.
- Ejemplo con el horario actual y bloque de 60: Manicura → 8:30, 9:30, 10:30, 11:30, 14:00 … 18:00. Manicura + pedicura → 8:30, 9:30, 10:30, 14:00 … 17:00.
- Reserva hasta **30 días** adelante; hoy, solo horarios que empiecen dentro de 60 min o más (`SUPUESTO`).
- **Máximo 3 citas activas sin atender por teléfono** (decisión de Tiago).
- «Nueva cita» del panel: horas libres sugeridas o la hora escrita a mano (5:30, 6:45, 17:30) con interruptor a. m./p. m., en tramos de 15 min y también fuera del horario.
- Días bloqueados (libres, feriados) desde el Calendario; bloquear un día no cancela las citas ya agendadas: el panel avisa cuántas hay.
- **Sin doble reserva garantizado por la base**: cada cita guarda los tramos de 15 min que ocupa y un índice único parcial `(date, tramo)` sobre las citas que retienen horario. Si dos personas confirman a la vez, una recibe `409` y vuelve al paso de elegir hora.

**Cancelación**: solo con teléfono (decisión de Tiago). La clienta escribe su número, ve sus citas activas (sin código ni QR) y cancela tras confirmar. El servidor exige que el teléfono coincida con la cita. Se puede cancelar hasta la hora de inicio (`SUPUESTO`). Cancelar libera el horario al instante.

**Código y QR**: código de 6 caracteres en mayúsculas, generado con `crypto` y alfabeto sin ambiguos (sin `0 O 1 I L`), único en la base. El QR codifica `https://nails-art-sc.vercel.app/admin/escanear?codigo=NA84K2`: el panel lo lee con la cámara y la URL abre la verificación si se escanea con la cámara del teléfono.

**Teléfono**: se normaliza a dígitos con código de país. Por defecto Venezuela (`0414 1234567` → `584141234567`); con `+` se acepta cualquier país (`SUPUESTO`).

**Clientas**: el directorio se crea o actualiza al reservar, por teléfono. Guarda nombre, reservas totales, asistencias, última cita y última visita.

**Dinero**: no hay precios en la v1. Si se añaden, en USD (`PENDIENTE`).

**Tiempo**: fechas civiles `YYYY-MM-DD` y horas `HH:mm` como texto de punta a punta; «hoy» lo calcula el servidor en `America/Caracas`.

## 5. Stack y por qué

| Pieza | Elección | Motivo |
|---|---|---|
| Front | Next.js 16 (App Router) + React 19 + JavaScript | Lo pide el encargo; portal público rápido y panel en una sola app |
| Estilos | Tailwind CSS 3.4 con `tailwind.config.js` y variables CSS | El encargo pide `tailwind.config.js`; los colores salen de variables editables desde el panel |
| API | Express 5 modular, montada en `src/pages/api/[...path].js` | Un solo proyecto en Vercel (decisión de Tiago): un deploy, mismas cookies, sin CORS. Express también arranca solo en local (`npm run api`) |
| Datos | MongoDB Atlas + Mongoose 9, conexión cacheada | Lo pide el encargo; encaja con Vercel y la integración del Marketplace (`MONGODB_URI`) |
| Validación | zod 4, esquemas compartidos en `shared/` | Misma regla en cliente y servidor |
| QR | `qrcode` (servidor) y `html5-qrcode` (escáner) | Lo pide el encargo |
| Sesión | Cookie `HttpOnly` con JWT firmado (12 h); contraseña con scrypt | Un solo rol (superadmin). El secreto de firma sale de `ADMIN_SESSION_SECRET` o, si no existe, se genera al azar y se guarda en la base |
| Alta del superadmin | `/admin/setup` + `POST /api/auth/setup`, abierta hasta la primera cuenta | Decisión de Tiago: sin clave de instalación. Riesgo aceptado: quien llegue antes crea la cuenta, por eso se hace justo tras el deploy y luego se retira |
| Local sin Atlas | `mongodb-memory-server` con datos en `.data/` | Arrancar y probar sin instalar MongoDB |

Nota: en un proyecto Next.js, Vercel no usa la carpeta raíz `api/` (es para otros frameworks); por eso Express va dentro de `pages/api` y `vercel.json` configura esa función.

## 6. Identidad visual

Paleta **A · Lila claro**, sacada del logo, tema claro. Base Liquid Glass (sobria en el portal público, más movimiento en el panel). Contraste AA comprobado.

| Token | Hex | Uso |
|---|---|---|
| `--color-primary` | `#4B1C71` | Botones principales, enlaces (morado del logo) |
| `--color-secondary` | `#D3B0F4` | Superficies de marca, código del ticket (lila del logo) |
| `--color-accent` | `#8E3FC7` | Detalles, foco, estados activos |
| `--color-bg` | `#F8F2FE` | Fondo |
| `--color-text` | `#2A0F40` | Texto |

Los cinco se editan en Configuración; el panel avisa si una combinación no pasa AA. Detalle en `docs/IDENTIDAD-VISUAL.md`.

## 7. Integraciones

- WhatsApp por enlace `wa.me` (envío manual): confirmación de la clienta al salón y contacto del salón a la clienta.
- QR: generación en servidor y lectura con cámara en el panel.
- Imagen del ticket: PNG en canvas + compartir del sistema en móvil.

## 8. Entrega y forma de trabajar

- Código en `C:\Users\santi\OneDrive\Escritorio\Tiago\programacion\proyects\nails-art-reserve`.
- Repositorio `Iammtiago/nails-art-reserve` (ya creado por Tiago, **público**: nunca se suben secretos). Primer commit de esqueleto en `main` (repo vacío, sin Vercel conectado aún); el resto en `feat/reservas-v1` con PR. El merge a `main` y el deploy los ordena Tiago.
- Despliegue: proyecto Vercel `nails-art` → `https://nails-art-sc.vercel.app`, MongoDB desde el Vercel Marketplace. Solo cuando Tiago lo diga.
- Entregables: código completo, `README.md` con guía CLI (git, GitHub, Vercel, Marketplace, variables, producción), `docs/API.md`, pruebas automáticas de lo crítico.

## 9. SUPUESTO y PENDIENTE

**SUPUESTO**

- Bloque de 60 min y pausa 12:30–14:00 de lunes a sábado, según el Instagram.
- Antelación mínima de 60 min para reservar el mismo día.
- La clienta puede cancelar hasta la hora de inicio.
- Teléfono venezolano por defecto; otros países con `+`.
- La verificación por código (`POST /api/appointments/verify`) exige sesión de administración.
- Bloquear un día no cancela citas existentes.
- Rutas de la API sin versión (`/api/settings`, no `/api/v1`), tal como las pidió el encargo.
- Límite de intentos de acceso al panel: 5 cada 15 min por IP, guardado en MongoDB (sirve en serverless).
- Cada cuenta puede ponerle una contraseña nueva a otra (así se recupera un olvido) sin pedir la anterior; para la propia se pide la actual.
- Los índices se crean en la primera conexión de cada instancia (idempotente): el índice único de horarios es lo que impide la doble reserva y no puede faltar.

**PENDIENTE**

- Confirmar WhatsApp, horario y dirección reales con el salón.
- Precios de los servicios (si se quieren mostrar).
- Logo en alta resolución o vectorial (hoy se usa el JPG recibido).
- Deploy en Vercel y base en Atlas: cuando Tiago lo ordene.
- Recuperar el acceso si se olvida la contraseña: la otra cuenta le pone una nueva desde Cuentas. Si ambas la olvidan, no hay flujo por correo (habría que proponerlo).
