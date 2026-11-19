# Nails Art · Reservas

Aplicación de reservas para **Nails Art**, manicurista independiente (`@nailsart.sc`, San Cristóbal).

- **Portal público `/`:** cabecera fija con **Agendar**, **Cancelar** y **Llamar**; hero con estado en vivo (abierto o cerrado), frase de impacto y, en escritorio, atajo para elegir servicio. La clienta elige servicio → día → hora → escribe nombre y teléfono, y recibe un ticket con **código QR** y **clave de 6 caracteres** que puede guardar en la galería y confirmar por WhatsApp. Debajo: cómo funciona, reglas (salen de Configuración), horario, contacto y preguntas frecuentes. También puede **cancelar** sus citas con su teléfono.
- **Panel `/admin`:** Citas, Calendario, Escanear código (cámara o clave), Clientes, Configuración (datos, logo, horarios, servicios, reglas y colores) y **Cuentas** (quién entra al panel; todas con acceso completo).

Stack: Next.js 16 (App Router) · React 19 · JavaScript · Tailwind CSS 3.4 · Express 5 (API REST modular) · MongoDB + Mongoose 9 · zod 4.
Un solo proyecto en Vercel: la API Express se monta dentro de Next en `src/pages/api/[...path].js` (en un proyecto Next, Vercel no usa la carpeta raíz `api/`). La misma API corre sola en local con `npm run api`.

Documentos: [brief](docs/BRIEF.md) · [plan](docs/PLAN.md) · [API](docs/API.md) · [identidad visual](docs/IDENTIDAD-VISUAL.md) · [guía de interfaz](docs/FRONTEND.md).

## Estructura

```
nails-art-reserve/
├─ shared/                 Lógica pura usada por API e interfaz
│  ├─ constants.js         Servicios, horario y paleta por defecto, alfabeto del código
│  ├─ schedule.js          Motor de disponibilidad (turnos, pausa, bloques, tramos de 15 min)
│  ├─ time.js · format.js  Fechas civiles y formato es-VE
│  ├─ phone.js             Normalización de teléfonos (Venezuela por defecto)
│  ├─ schemas.js           Esquemas zod de todas las entradas
│  ├─ color.js             Contraste WCAG y tokens derivados de la paleta
│  ├─ whatsapp.js          Enlaces wa.me y mensajes
│  └─ test/                Pruebas de la lógica compartida
├─ server/                 API Express
│  ├─ app.js               createApp(): helmet, cors, json 4 MB, rutas, errores
│  ├─ index.js             Servidor suelto (npm run api)
│  ├─ config/env.js        Variables de entorno
│  ├─ lib/                 db (conexión cacheada), qr, booking-code, password (scrypt), errors, clock
│  ├─ models/              Settings, Appointment, Client, AdminUser, RateLimit, AppSecret
│  ├─ services/            Lógica de negocio (citas, disponibilidad, calendario, clientas, acceso)
│  ├─ routes/              settings, appointments, admin, auth
│  ├─ middleware/          CSRF, conexión, sesión, validación, errores
│  └─ test/                Pruebas de integración (MongoDB en memoria)
├─ src/
│  ├─ app/                 Páginas (/, /admin/*), layout, estilos globales, iconos
│  ├─ pages/api/[...path].js  Monta Express en /api/* (función de Vercel)
│  ├─ components/ui/       Kit: botón, campo, modal, avisos, confirmación, estados, insignias…
│  ├─ components/booking/  Portal público: pasos, calendario, horas, ticket, cancelar
│  ├─ components/admin/    Shell del panel, acceso, alta de superadmin y las 5 secciones
│  ├─ lib/                 Cliente HTTP, hooks, imagen del ticket, ajustes en servidor
│  └─ proxy.js             CSP con nonce por petición
├─ scripts/                sync-indexes.js, seed-demo.js
├─ public/logo.png
├─ docs/
├─ next.config.mjs · tailwind.config.js · postcss.config.mjs · vercel.json · jsconfig.json
└─ .env.example
```

## Arrancar en local

Requisitos: Node 20.9 o superior.

```bash
npm install
```

```bash
cp .env.example .env.local
```

Rellena `.env.local`. Para probar en local puedes dejar `MONGODB_URI` vacío: se usa una base MongoDB en memoria guardada en `.data/` (la primera vez descarga el binario de MongoDB 7.0, unos 600 MB). Crea tu usuario local con `ADMIN_USERNAME=tu-usuario ADMIN_PASSWORD=tu-clave npm run admin:create` (también sirve para recuperar el acceso si todas las cuentas olvidan su contraseña, apuntando `MONGODB_URI` a la base real).

¿Otro servidor de desarrollo ya usa esta carpeta? Arranca un segundo con su propia compilación y su propia base: `NEXT_DIST_DIR=.next-alt LOCAL_DB_DIR=.data/mongo-alt npx next dev --port 3100`.

```bash
npm run dev
```

- Portal: http://localhost:3000
- Panel: http://localhost:3000/admin

| Script | Qué hace |
|---|---|
| `npm run dev` | Next en desarrollo (web + API en el mismo puerto) |
| `npm run build` / `npm start` | Compilación y servidor de producción |
| `npm run api` | Solo la API Express en `http://localhost:4000/api` |
| `npm test` | Todas las pruebas (lógica compartida + API con MongoDB en memoria) |
| `npm run db:indexes` | Crea y lista los índices de la base indicada en `MONGODB_URI` |
| `npm run seed:demo` | **BORRA** citas y clientas y crea datos ficticios. Solo con `ALLOW_DEMO_SEED=true`, nunca en producción. Detén `npm run dev` antes si usas la base local |

## Variables de entorno

| Variable | Obligatoria | Para qué |
|---|---|---|
| `MONGODB_URI` | Sí en producción | Conexión a MongoDB Atlas (la crea la integración del Marketplace de Vercel) |
| `APP_URL` | Recomendada | URL pública (`https://nails-art-sc.vercel.app`); va dentro del QR |
| `ADMIN_SESSION_SECRET` | Opcional | Secreto de 32+ caracteres para firmar la sesión. Si falta, el servidor genera uno al azar y lo guarda en la base |
| `CORS_ORIGINS`, `API_PORT` | Solo `npm run api` | Orígenes permitidos y puerto de la API suelta |

## Reglas importantes

- **Sin doble reserva:** cada cita guarda los tramos de 15 min que ocupa y un índice único parcial `(date, occupiedTicks)` impide que dos citas activas se pisen, aunque lleguen a la vez (probado con 8 reservas simultáneas). Quien llega segundo recibe `409` y vuelve a elegir hora.
- Servicios por defecto: Manicura (1 h), Pedicura (1 h), Manicura + pedicura (2 h). Horario por defecto: lunes a sábado 8:30–12:30 y 14:00–19:00, domingo cerrado, horas cada 30 min (desde el 2026-11-19; una migración única pasó a 30 los días que estaban en 60, y luego se respeta lo que elija la dueña en «Horas cada»). Nombres de servicio hasta 80 caracteres. La página recuerda el nombre y el teléfono de la clienta en su propio dispositivo (`localStorage`, clave `nails-art:contact`, botón «No soy yo» para borrarlos). Todo editable en Configuración.
- Máximo **3 citas activas** por teléfono; reservas hasta 30 días adelante; el mismo día, con 60 min de antelación.
- La clienta cancela con su teléfono (debe coincidir con el de la cita) hasta la hora de inicio.
- «Hoy» lo decide el servidor en `America/Caracas`, nunca el navegador.
- Código de reserva: 6 caracteres sin `0 O 1 I L`, generado con `crypto`. El QR abre `/admin/escanear?codigo=XXXXXX`.

## Cuentas del panel (sin credenciales en el chat ni en el código)

La cuenta principal ya existe (Tiago la creó el 2026-11-16 con el alta web, que luego se retiró del código). Las demás se crean en **Panel → Cuentas** (contraseña de 6+ caracteres). Todas tienen acceso completo.

Si alguien olvida su contraseña, desde la otra cuenta: **Cuentas → Nueva contraseña**. Nadie puede borrar su propia cuenta, así el panel nunca se queda sin acceso.

**Modo superadmin oculto.** Cuatro toques rápidos sobre el título de cualquier sección del panel abren un modal que pide la clave (`1111`, fija por decisión de Tiago). Durante 15 minutos aparecen botones **Eliminar** en clientas (borra la clienta y todas sus citas) y en citas u horarios ocupados (borrado definitivo). Una banda roja indica que el modo está activo y tiene **Salir**. La clave se comprueba en el servidor, con 5 intentos cada 15 minutos, y cada borrado queda auditado en `purgelogs` con una copia de lo borrado.

Protecciones: contraseña con scrypt, sesión en cookie `HttpOnly` de 12 h, 5 intentos fallidos cada 15 min por IP, cabecera anti-CSRF en toda escritura, CSP con nonce, `helmet` en la API y `noindex` en el panel.

## Guía de despliegue por consola

Los pasos con 🔐 los haces tú (piden tu cuenta o tus claves).

### 1. Git y GitHub (`Iammtiago/nails-art-reserve`)

El repositorio ya existe. Desde la carpeta del proyecto:

```bash
git remote add origin https://github.com/Iammtiago/nails-art-reserve.git
```

```bash
git push -u origin main
```

```bash
git push -u origin feat/reservas-v1
```

Si el repositorio no existiera, se crea con GitHub CLI (privado o público) y se sube a la vez:

```bash
gh repo create Iammtiago/nails-art-reserve --private --source . --remote origin --push
```

### 2. Vercel

```bash
npm install -g vercel
```

```bash
vercel login
```

Vincula la carpeta al proyecto `nails-art` (`nails-art.vercel.app` pertenece a otra cuenta; el dominio del proyecto es `nails-art-sc.vercel.app`):

```bash
vercel link --project nails-art
```

Conecta el repositorio para que cada push a `main` despliegue a producción:

```bash
vercel git connect https://github.com/Iammtiago/nails-art-reserve
```

### 3. Base de datos desde el Vercel Marketplace

🔐 Instala la integración de MongoDB Atlas y crea la base; acepta los términos en la terminal o en el navegador (el nombre corto sale de la URL del Marketplace, `vercel.com/marketplace/mongodbatlas`):

```bash
vercel integration add mongodbatlas
```

La integración agrega `MONGODB_URI` al proyecto en Production, Preview y Development. Compruébalo:

```bash
vercel env ls
```

### 4. Variables de entorno

```bash
vercel env add APP_URL production --value https://nails-art-sc.vercel.app
```

Opcional, secreto de sesión fijo (si no, se genera solo y se guarda en la base):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

```bash
vercel env add ADMIN_SESSION_SECRET production
```

Usa `--value` o escribe el valor cuando lo pida; no lo pases con una tubería (`|`), porque añade un salto de línea al secreto.

### 5. Producción

```bash
vercel --prod
```

Comprueba que responde:

```bash
curl https://nails-art-sc.vercel.app/api/health
```

Luego crea el superadmin (sección «Superadmin») y prueba una reserva completa desde el móvil.

## Límites conocidos

- La cámara del escáner necesita `https` (en local funciona en `localhost`).
- «Guardar en galería»: en iPhone y Android abre el menú de compartir (desde ahí, «Guardar imagen»); en escritorio descarga el PNG.
- No hay recordatorios automáticos ni recuperación de contraseña del panel.
- El cuerpo de las peticiones en Vercel está limitado a 4,5 MB; el logo se reduce a 512 px en el navegador antes de subirlo.
