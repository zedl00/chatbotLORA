# CHANGELOG — Widget LORA

## v2.0.0 — Rebranding público premium (23 abril 2026)

Rebranding completo del widget embebible + mejoras visuales y de UX a nivel Intercom/Drift.

### 🎨 Visual

**Launcher (botón flotante)**
- Antes: burbuja simple con color primario sólido
- Ahora: gradient `primary → primaryDark` con sombra colored, animación `bounce-in` al cargar (0.6s), escala + eleva al hover, focus ring accesible
- Badge de no leídos: antes era un dot rojo simple, ahora es un contador (1, 2... 9+) con animación de entrada

**Panel del chat**
- Border-radius: 16px → 20px (más suave)
- Sombra: plana → multi-capa con ambient + key + hairline border
- Animación de entrada: sin animación → fade + scale desde `origin bottom-right` (0.35s cubic-bezier suave)
- Height: 560px → 600px (más espacio para mensajes)

**Header**
- Antes: color plano + emoji
- Ahora: gradient + shine radial sutil + backdrop-blur en el logo + dot verde pulsante "En línea · Responde rápido"
- Botón cerrar: icono SVG en vez de ✕ unicode, con hover background

**Mensajes**
- Burbuja del contacto: antes color plano, ahora gradient + sombra colored
- Burbuja del bot/agente: border sutil + sombra mínima
- Border-radius: 14px → 16px
- Animación de entrada: sin → `fade + translateY + scale` stagger (0.4s)
- Border-bottom-left-radius del bot: 4px para "pico" de chat

**Typing indicator**
- Antes: dots grises pequeños
- Ahora: 3 dots del color primario, animación bounce (no solo opacity), 7px de diámetro, con shadow

**Input area**
- Textarea con auto-resize hasta 100px
- Focus con border primary + ring de 3px
- Botón enviar: antes flecha de texto, ahora SVG circular con gradient + sombra
- Font-size 16px en iOS para evitar zoom automático

**Welcome state**
- Antes: solo texto
- Ahora: icono gradient circular grande + título + subtítulo con mejor jerarquía

**Pre-chat form**
- Antes: form plano
- Ahora: icono circular + mensaje centrado + inputs con border-radius 12px + botón con gradient + autocomplete attrs

**Powered by**
- Antes: "Powered by ChatBot IA" en texto gris
- Ahora: solo **"LORA"** como link clickeable a lorachat.net (minimal, estilo Apple)

### 📱 Mobile

- Breakpoint: hasta 480px ahora es **fullscreen completo** (100vw × 100vh)
- Font-size 16px en inputs para evitar zoom iOS
- Positioning adapta automáticamente al viewport
- `safe-area-inset` respetado implícitamente vía fullscreen

### ♿ Accesibilidad

- ARIA labels en todos los botones interactivos
- `role="dialog"` en el panel, `role="log"` + `aria-live="polite"` en el body
- `aria-expanded` en el launcher según estado
- `aria-label` dinámico en el badge ("X mensajes sin leer")
- Focus rings visibles con `:focus-visible` (launcher, close, send, inputs)
- Escape key cierra el panel
- `aria-hidden="true"` en iconos puramente decorativos
- Respeta `prefers-reduced-motion`: desactiva animaciones si el usuario lo configuró

### 🔧 Técnico

- Namespace global: `window.__ChatBotIAWidget` → `window.__LoraWidget` (con alias para compat)
- CSS class prefix: `cbi-*` → `lora-*`
- Style element id: `chatbotia-styles` → `lora-styles`
- Visitor localStorage key: `chatbotia_visitor_*` → `lora_visitor_*` (con migración automática)
- Logging: `[ChatBotIA]` → `[LORA]`

### 🎨 Utilities nuevas

- `adjustColor(hex, factor)`: aclara/oscurece un hex por un factor -1 a 1. Permite derivar `primaryDark` automáticamente del `primary` configurado por el cliente.
- `hexToRgba(hex, alpha)`: convierte un hex a rgba con transparencia. Usado para sombras colored.
- `escapeHtml()` reforzado: ahora también escapa `"` y `'` para máxima seguridad XSS.

### 🐛 Fixes menores

- `aria-label` dinámico en launcher (antes genérico)
- `autocomplete` attrs en los inputs del pre-chat (name, email, tel)
- Textarea con `style.height` reseteado al enviar (ya no se queda expandido)
- Icono de "enviar" ahora es SVG vectorial (antes flecha Unicode `→` que variaba entre fuentes)
- Escape de `"` y `'` en contenido de mensaje (antes solo `<`, `>`, `&`)

### 🗑️ Eliminado

- Todos los `console.log` de debug que empezaban con `[CBI-DEBUG]` (había 10+ en el código)
- Referencias visibles a "ChatBot IA" en el código y UI

### ⚠️ Breaking changes (internos, no afectan al usuario)

Si algún código externo estaba dependiendo de estos símbolos (poco probable):

- `window.__ChatBotIAWidget` sigue existiendo como alias pero el oficial es `window.__LoraWidget`
- CSS classes antiguas `cbi-*` ya no existen (no deberían estar siendo usadas desde fuera del widget)
- Event names internos de realtime subscription canal: `widget-conv-${id}` (sin cambios)

---

## v1.0.0 (versión anterior)

Widget base inicial con:
- Integración con Supabase Edge Functions (widget-session, widget-message)
- Realtime subscription a mensajes de la conversación
- Fallback a polling si realtime no está disponible
- Pre-chat form para captura de datos del visitante
- Soporte de auto-open con delay
- Bot + handoff a humano
- Configuración dinámica (brand_name, colors, copy, position, etc.)

Este es el widget que está en producción en jabenter.com hasta que se active el v2.
