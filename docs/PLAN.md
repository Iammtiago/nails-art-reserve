# Plan por fases

Cada fase termina en algo que se puede ver funcionando y en un commit.

| Fase | Entrega | Cómo se comprueba |
|---|---|---|
| 1 · Esqueleto y API | Repositorio, configuración (Next, Tailwind, Vercel, `.env.example`), lógica compartida (horarios, teléfono, esquemas), modelos Mongoose, rutas Express, conexión cacheada, pruebas | `npm test` en verde: disponibilidad, doble reserva concurrente, límite de 3 activas, cancelar libera, código sin ambiguos, acceso al panel |
| 2 · Identidad y reserva pública | Tokens y `globals.css`, kit de interfaz, portal `/` con los 4 pasos, ticket con QR, guardar en galería, WhatsApp, modal de cancelar | Recorrido completo en el navegador a 375 px y 1280 px, consola limpia. Pantalla de muestra para que Tiago ajuste colores |
| 3 · Panel de administración | Acceso con contraseña y las 5 secciones: Configuración, Calendario, Citas, Clientes, Escanear | Recorrido por sección en navegador y API; escáner con código manual |
| 4 · Revisión y entrega | `code-review`, `security-review`, README con guía CLI, `docs/API.md`, PR a `main` | Pruebas de nuevo, build de producción (`next build`) sin errores |

El deploy a Vercel queda fuera del plan hasta que Tiago lo ordene.
