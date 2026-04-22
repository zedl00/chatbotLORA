# Plan de Commits — Sprint 3 (Motor IA)

> **Ruta:** `/docs/AI_COMMITS.md`
> Secuencia recomendada para integrar el módulo AI via feature branch.

## Preparación

```bash
git checkout develop
git pull origin develop
git checkout -b feature/ai-engine
```

## Secuencia

```bash
# 1. Schema SQL
git add supabase/migrations/20260423000001_ai_schema.sql
git commit -m "feat(db): schema del motor ia con bot personas, chunks y usage log"

# 2. Helper compartido
git add supabase/functions/_shared/anthropic.ts
git commit -m "feat(functions): helper compartido de anthropic api y calculo de costos"

# 3. Edge Functions core
git add supabase/functions/claude-chat/ \
        supabase/functions/claude-classify/ \
        supabase/functions/claude-summarize/ \
        supabase/functions/claude-suggest/
git commit -m "feat(functions): edge functions de chat, clasificacion, resumen y sugerencias"

# 4. Embeddings + playground
git add supabase/functions/claude-embed/ \
        supabase/functions/ai-test-message/
git commit -m "feat(functions): embeddings con voyage ai y playground injector"

# 5. Tipos frontend
git add src/types/ai.types.ts
git commit -m "feat(types): tipos del modulo ia con labels de ui"

# 6. Repository + service
git add src/repository/supabase/ai.repo.ts \
        src/repository/index.ts \
        src/services/claude.service.ts
git commit -m "feat(repository): repositorio ai y servicio cliente"

# 7. Vistas IA
git add src/modules/ai/ \
        src/modules/playground/
git commit -m "feat(ai): vistas de personalidades y playground"

# 8. Knowledge base + dashboard
git add src/modules/knowledge/views/KnowledgeView.vue \
        src/modules/reports/views/DashboardView.vue
git commit -m "feat(ai): base de conocimiento con rag y dashboard con metricas"

# 9. Router + layout
git add src/router/index.ts \
        src/layouts/AdminLayout.vue
git commit -m "feat(router): rutas /admin/ai-personas /admin/playground y seccion IA en menu"

# 10. Docs
git add docs/AI_INTEGRATION.md docs/AI_COMMITS.md
git commit -m "docs: guia de integracion del motor ia y plan de commits"

# 11. Changelog + context
git add CHANGELOG.md CONTEXT.md
git commit -m "docs(changelog): release v0.3.0 con motor ia"

# 12. Push
git push -u origin feature/ai-engine
```

## Tras merge a develop

```bash
git checkout develop && git pull
git checkout main && git pull
git merge develop --no-ff -m "chore(release): v0.3.0 motor ia completo"
git tag -a v0.3.0 -m "v0.3.0 - Motor IA: Claude + RAG + Playground + Dashboard"
git push origin main --tags
```
