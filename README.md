# Riego Dashboard · Magdalena / Caña Brava

Dashboard de análisis de cumplimiento de riego y fertilización.

## Archivos
| Archivo | Descripción |
|---------|-------------|
| `index.html` | Dashboard principal (autocontenido) |
| `manifest.json` | Configuración PWA |
| `sw.js` | Service Worker (offline + updates) |
| `icon-192.jpg` | Ícono app |
| `icon-512.jpg` | Ícono app (alta res) |
| `_headers` | Cabeceras HTTP para Netlify |

## Cómo actualizar
1. Edita `index.html` (o cualquier archivo)
2. En `sw.js` cambia el número en `VERSION = 'v2'` → `'v3'` etc.
3. Commit + Push → Netlify redespliega automáticamente
4. Los usuarios ven el banner "Nueva versión disponible"

## Desarrollado con Claude · Anthropic
