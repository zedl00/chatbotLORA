# Plan de Commits — Sprint 4 (Widget + Inbox)

```bash
git checkout develop && git pull
git checkout -b feature/widget-inbox

# 1. Schema
git add supabase/migrations/20260424000001_widget_inbox.sql
git commit -m "feat(db): schema para widget configs, sessions e inbox realtime"

# 2. Edge Functions del widget
git add supabase/functions/widget-session/ supabase/functions/widget-message/
git commit -m "feat(functions): edge functions publicas para widget web"

# 3. Widget embebible
git add public/widget.js widget/public/demo.html
git commit -m "feat(widget): script embebible vanilla js con realtime"

# 4. Tipos y repositorio del inbox
git add src/types/inbox.types.ts src/repository/supabase/inbox.repo.ts
git commit -m "feat(inbox): tipos y repositorio con filtros y acciones"

# 5. Composable realtime
git add src/composables/useRealtimeInbox.ts
git commit -m "feat(inbox): composable para suscripciones realtime"

# 6. Vistas del inbox
git add src/modules/inbox/
git commit -m "feat(inbox): layout 3 paneles estilo whatsapp con chat realtime"

# 7. Módulo de canales
git add src/modules/channels/
git commit -m "feat(channels): vista de canales con editor del widget y snippet"

# 8. Router
git add src/router/index.ts
git commit -m "feat(router): rutas /admin/inbox y /admin/channels funcionales"

# 9. Docs
git add docs/WIDGET_INBOX_INTEGRATION.md docs/WIDGET_INBOX_COMMITS.md
git commit -m "docs: guia de integracion sprint 4"

# 10. Changelog + context
git add CHANGELOG.md CONTEXT.md
git commit -m "docs(changelog): release v0.4.0 widget web + inbox funcional"

git push -u origin feature/widget-inbox
```

## Tras merge a develop

```bash
git checkout develop && git pull
git checkout main && git pull
git merge develop --no-ff -m "chore(release): v0.4.0 widget e inbox"
git tag -a v0.4.0 -m "v0.4.0 - Widget Web embebible + Inbox funcional con realtime"
git push origin main --tags
```
