# Identidad visual · Nails Art

Aprobada por Tiago el 2026-11-16 (paleta A «Lila claro»). No se cambia sin que él lo pida.

## Origen

Colores medidos píxel a píxel en el logo recibido (círculo lila con letras moradas, mano dibujada y frasco de esmalte):

- Lila del círculo: `#D3B0F4`
- Morado de las letras: `#4B1C71`

## Paleta (editable desde `/admin/configuracion`)

| Variable | Hex | Uso | Contraste |
|---|---|---|---|
| `--color-primary` | `#4B1C71` | Botones principales, navegación activa, títulos de marca | Blanco sobre primario 12,3:1 |
| `--color-secondary` | `#D3B0F4` | Bloque del código del ticket, superficies de marca | Texto sobre secundario 9,1:1 |
| `--color-accent` | `#8E3FC7` | Foco, detalles, enlaces secundarios | Acento sobre fondo 5,2:1 |
| `--color-bg` | `#F8F2FE` | Fondo de la aplicación | — |
| `--color-text` | `#2A0F40` | Texto principal | Texto sobre fondo 15,4:1 |

Derivados que calcula `shared/color.js` (`buildThemeTokens`) a partir de los cinco anteriores: texto secundario y terciario (siempre ≥ 4,5:1 sobre el fondo), color de texto sobre cada relleno (blanco o tinta, el que más contraste dé), superficie, línea y versiones suaves de primario, secundario y acento. Cualquier paleta que se guarde desde el panel conserva el texto legible: si un color de texto no llega a AA, se oscurece automáticamente.

Estados (fijos): éxito `#1F7A4D`, aviso `#8A5A00`, peligro `#B42335`, información `#1F5FA8`, cada uno con su fondo suave.

## Tipografía

- Títulos y cifras: **Playfair Display** (elegante, editorial; par recomendado por `ui-ux-pro-max` para belleza y spa).
- Texto e interfaz: **Inter**.
- Ambas autoalojadas con `next/font` (sin peticiones a Google en tiempo de ejecución; compatibles con la CSP).

## Estilo

- **Liquid Glass equilibrado:** superficies translúcidas con desenfoque de 20 px, borde especular de 1 px con máscara y sombra suave teñida de morado. Clases `.glass` y `.glass glass-strong`. Sin `backdrop-filter` el vidrio pasa a opaco.
- **Aurora** detrás del contenido (tres manchas lila, acento y primario muy desenfocadas). En el panel se mueve despacio; en el portal público está quieta.
- Radios: tarjetas 20 px, controles 14 px, píldoras redondas.
- Movimiento: panel generoso (entradas escalonadas), portal público sobrio. Se respeta «reducir movimiento».
- Iconos: `lucide-react` (trazo). Instagram con un SVG propio (lucide ya no trae marcas).

## Logo

- `public/logo.png`: el logo recortado en círculo con fondo transparente (512 px).
- `src/app/icon.png` y `apple-icon.png`: iconos del navegador y del teléfono.
- Desde Configuración se puede subir otro logo (se reduce a 512 px en el navegador antes de guardarse).
