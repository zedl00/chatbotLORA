# Git Workflow

> **Ruta:** `/docs/GIT_WORKFLOW.md`

## 🌳 Estructura de Ramas

```
main (producción)  ◄──── hotfix/*
  ▲
  │ merge con PR aprobado
  │
develop (staging)  ◄──── feature/* , fix/* , change/*
```

| Rama | Propósito | Reglas |
|---|---|---|
| `main` | Producción | Solo merge vía PR. Nunca push directo. Protegida. |
| `develop` | Integración / staging | Merge frecuente de features. Deploy automático a staging. |
| `feature/<nombre>` | Nueva funcionalidad | Crear desde `develop`. Ej: `feature/inbox-realtime` |
| `fix/<nombre>` | Bug no urgente | Crear desde `develop`. Ej: `fix/webhook-hmac` |
| `hotfix/<nombre>` | Urgencia en producción | Crear desde `main`. Merge a `main` **y** `develop`. |
| `change/<nombre>` | Change request aprobado | Crear desde `develop`. |
| `release/<version>` | Preparación de release | Crear desde `develop` cuando esté listo para QA. |

## ✍️ Conventional Commits (obligatorio)

Formato:
```
<tipo>(<scope opcional>): <descripción en minúsculas>
```

**Tipos permitidos:**
| Tipo | Cuándo usarlo |
|---|---|
| `feat` | Nueva funcionalidad |
| `fix` | Corrección de bug |
| `docs` | Solo documentación |
| `style` | Formato/espacios (no lógica) |
| `refactor` | Cambio interno sin nueva funcionalidad ni fix |
| `perf` | Mejora de rendimiento |
| `test` | Agregar o modificar tests |
| `chore` | Tareas de mantenimiento (deps, build, CI) |
| `ci` | Cambios en pipelines |
| `build` | Cambios en sistema de build |

**Ejemplos válidos:**
```
feat(inbox): agregar filtro por canal en la bandeja
fix(meta-webhook): corregir validación de firma HMAC en grupos
feat(ai): resumen automático en handoff IA → agente
docs(readme): agregar instrucciones de deploy a Supabase
refactor(repository): extraer mapper de conversations a archivo aparte
chore(deps): actualizar supabase-js a v2.45.4
perf(inbox): paginar v_inbox para listas >1000 conversaciones
```

**Ejemplos inválidos:** ❌
```
Added new feature       ← no sigue el formato
fix: Bug                ← descripción en mayúscula y vacía
update stuff            ← sin tipo
feat(inbox): Agregué un filtro nuevo.   ← mayúscula + punto final
```

## 🔀 Flujo de Trabajo Diario

### Iniciar una tarea

```bash
# 1. Actualizar develop
git checkout develop
git pull origin develop

# 2. Crear rama de la tarea
git checkout -b feature/inbox-filters

# 3. Marcar tarea como "In Progress" en Notion
#    y anotar el nombre de la rama en el campo "Notes"
```

### Durante el desarrollo

```bash
# Commits atómicos siguiendo Conventional Commits
git add src/modules/inbox/
git commit -m "feat(inbox): agregar filtro de canal con multi-select"

git add src/modules/inbox/
git commit -m "feat(inbox): persistir filtros en query params"

# Pushes frecuentes (backup + CI si ya existe)
git push -u origin feature/inbox-filters
```

### Cerrar la tarea

```bash
# 1. Asegurar que develop no avanzó mientras tanto
git fetch origin
git rebase origin/develop   # o merge si prefieres

# 2. Push final
git push --force-with-lease origin feature/inbox-filters

# 3. Abrir PR en GitHub apuntando a `develop`
#    - Usar el template de PR
#    - Asignar revisor
#    - Pegar link del PR en la tarea de Notion
```

### Merge

- Requisitos: 1 aprobación, CI verde, ramas al día.
- **Squash merge** por defecto (mantiene `develop` limpio).
- Tras el merge: actualizar tarea en Notion a "Done".

## 🚨 Hotfix Urgente

```bash
# Desde main
git checkout main
git pull origin main
git checkout -b hotfix/meta-token-rotation

# ... cambios ...

git commit -m "fix(channels): rotar access token de WhatsApp desde config"
git push -u origin hotfix/meta-token-rotation

# PR a main → merge → deploy
# Después: merge de main hacia develop para mantener sincronizado
git checkout develop
git merge main
git push origin develop
```

## 🛡️ Protección de Ramas

En GitHub → **Settings → Branches → Branch protection rules** para `main`:

- ✅ Require pull request reviews before merging (mínimo 1)
- ✅ Require status checks to pass (CI)
- ✅ Require branches to be up to date
- ✅ Do not allow bypassing the above settings
- ✅ Restrict who can push (solo owner)

Idéntico para `develop` pero con 1 aprobación mínima.

## 📝 Template de Pull Request

Ver `.github/pull_request_template.md`. Campos obligatorios:

- **Qué hace este PR** (descripción clara)
- **Tipo de cambio** (checkboxes)
- **Tests realizados**
- **Screenshots** si hay cambios visuales
- **Checklist** (sin `console.log`, vars en `.env.example`, Notion actualizado)

## 🔗 Vínculo con Notion

Cada rama debe tener una tarea en Notion. El ciclo completo:

1. Crear tarea en Notion con label `feature`, `fix`, `change`, etc.
2. Al iniciar → `status = In Progress` + pegar nombre de rama en `Notes`.
3. Al abrir PR → pegar link del PR en la tarea.
4. Al mergear → `status = Done` + agregar nota de lo implementado.

Opcional: usar `scripts/notion-sync.ts` para automatizar el paso 4.
