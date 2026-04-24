# 📊 Sprint 10 — Agent Analytics

El cuadrante **D** del Agent Workspace: dashboard completo de métricas con 7 gráficos, 6 filtros enterprise, y export CSV.

---

## 📦 Archivos incluidos (16)

| Ruta | Tipo | Descripción |
|---|---|---|
| `supabase/migrations/2026_sprint_10.sql` | 🆕 SQL | Permisos + 2 vistas + RPC heatmap + seed 50 convs |
| `src/types/analytics.types.ts` | 🆕 Tipos | Filtros, summary, charts, helpers de fechas |
| `src/repository/supabase/analytics.repo.ts` | 🆕 Repo | Queries y cálculos de métricas |
| `src/modules/analytics/views/AnalyticsView.vue` | 🆕 Vista | Página principal con 4 tabs |
| `src/modules/analytics/components/DateRangePicker.vue` | 🆕 | Selector con 10 presets + custom |
| `src/modules/analytics/components/MetricCard.vue` | 🆕 | Card reutilizable con deltas |
| `src/modules/analytics/components/VolumeLineChart.vue` | 🆕 | Gráfico línea con comparativo |
| `src/modules/analytics/components/StatusDonutChart.vue` | 🆕 | Dona de estados (4 segmentos) |
| `src/modules/analytics/components/TopAgentsBarChart.vue` | 🆕 | Barras horizontales top 5 |
| `src/modules/analytics/components/HourlyHeatmap.vue` | 🆕 | Heatmap 7 × 24 horas |
| `src/modules/analytics/components/AgentRadarChart.vue` | 🆕 | Radar 5 ejes por agente |
| `src/modules/analytics/components/FrtVolumeBubbleChart.vue` | 🆕 | Bubble FRT vs volumen |
| `src/modules/analytics/components/ExportCsvButton.vue` | 🆕 | Export conversaciones/agentes |
| `src/modules/analytics/tabs/LeaderboardTab.vue` | 🆕 | Ranking con 🥇🥈🥉 |
| `src/modules/analytics/tabs/ComparativoTab.vue` | 🆕 | Tabla vs período anterior |
| `src/layouts/AdminLayout.vue` | 🔧 | + menú "📈 Analytics" |
| `src/router/index.ts` | 🔧 | + ruta /admin/analytics |

---

## 🚀 Aplicación

### Paso 1: SQL (crítico)

Supabase → SQL Editor → pega el contenido completo de `2026_sprint_10.sql` → Run.

**Verifica que al final veas:**
```
permisos:            2
vista_analytics:     true
vista_agent_metrics: true
rpc_heatmap:         true
seed_conversations:  50
seed_por_estado:
  abandoned: 5
  open:      7
  pending:   8
  resolved:  30
```

✅ Si los 5 checks pasan, continúa.

### Paso 2: Copiar archivos

Copia las **16 rutas** respetando estructura desde `/src/`.

### Paso 3: Build

```powershell
cd C:\xampp\htdocs\proyectos\chatbot
npm run build
```

Si pasa sin errores TS → Paso 4. Si falla → pégame el error.

### Paso 4: Deploy FTP

```
CoreFTP → ftp.jabenter.com → usuario lora@jabenter.com
→ /public_html/lora/
→ Borrar contenido
→ Subir todo el contenido de dist/
```

### Paso 5: Verificar en lora.jabenter.com

1. Login
2. Click en el nuevo menú **"📈 Analytics"** arriba del sidebar
3. URL: `/admin/analytics`

**✅ Esperado:** dashboard carga con datos seed.

---

## 🧪 Tests de verificación

### Test 1 — Dashboard carga con datos

Debes ver:
- **Banner azul/verde** "Este período vs anterior..."
- **5 metric cards** con números reales
- **Tab "Dashboard" activo** con 6 gráficos + preview leaderboard

### Test 2 — Selector de fechas

1. Click en el botón `📅 Últimos 7 días`
2. Dropdown con grupos: Rápidos / Por mes / Últimos N días / Año / Personalizado

**Prueba:**
- Click "Hoy" → dashboard se actualiza (probablemente vacío si no hay convs de hoy)
- Click "Últimos 30 días" → deberías ver los 50 seed
- Click "Personalizado" → date inputs + botón Aplicar

### Test 3 — Filtros enterprise

Prueba cada uno:
- **Agente:** dropdown con nombres (filtra el dashboard)
- **Canal:** web_widget / WhatsApp / etc.
- **Estado:** Abiertas / Pendientes / Resueltas / Abandonadas
- **Prioridad:** Sin / Baja / Media / Alta
- **Equipo:** si existe tabla teams (si no, el selector no aparece)

### Test 4 — Los 7 gráficos

Scroll en tab Dashboard:

1. **📈 Línea volumen diario** — línea azul sólida (actual) + punteada (anterior)
2. **🍩 Dona estados** — 4 colores con leyenda
3. **📊 Top agentes** — barras horizontales con initiales
4. **🎯 Radar agente** — pentágono con dropdown para elegir agente
5. **🔥 Heatmap** — grid 7×24 con colores purple
6. **🫧 Bubble** — burbujas coloreadas por CSAT
7. **🏆 Leaderboard preview** — top 3 abajo

### Test 5 — Tab Leaderboard

Click tab **🏆 Leaderboard**:
- Lista completa con medallas 🥇🥈🥉
- Info: resueltas, FRT, CSAT, % resolución, volumen

### Test 6 — Tab Horarios

Click tab **🔥 Horarios**:
- Heatmap grande con leyenda de intensidad
- Hover en cada celda muestra: "Lun 14:00 — X conversaciones"

### Test 7 — Tab Comparativo

Click tab **🎯 Comparativo**:
- 4 cards comparando período actual vs anterior:
  - Volumen, Resueltas, FRT, CSAT
- Deltas en verde (mejor) o rojo (peor)

### Test 8 — Export CSV

Hover sobre botón **📥 Exportar CSV**:
- 2 opciones: Conversaciones (50 filas) / Agentes
- Click → descarga archivo .csv con datos filtrados
- Abre en Excel → verifica encabezados y valores

---

## 🧹 Limpiar seed después

Cuando ya no necesites los datos de demo:

```sql
-- Borrar los 50 conversations + sus mensajes
DELETE FROM conversations WHERE metadata->>'seed' = 'true';
-- Los mensajes se borran en cascada (ON DELETE CASCADE en conversation_id)
```

Si el contacto demo también:
```sql
DELETE FROM contacts WHERE metadata->>'seed' = 'true';
```

---

## 📊 Fórmulas de métricas

| Métrica | Fórmula |
|---|---|
| **FRT** | `first_response_at - handoff_at` |
| **Resolution time** | `resolved_at - created_at` |
| **Handoff rate** | `conversaciones con agent_id / total × 100` |
| **Resolution rate** | `resolved / total × 100` |
| **CSAT promedio** | `AVG(csat_score) WHERE NOT NULL` |
| **Radar score compuesto** | `resolved + csat × 5 - frt_min` |

---

## 🎨 Diseño visual

- **Colores:** paleta consistente (brand-blue, emerald, amber, red)
- **Layout:** grid responsive (desktop 3-col, mobile stacked)
- **Charts:** SVG puro, cero librerías externas (todo custom)
- **Estados vacíos:** mensajes amigables cuando no hay data

---

## 🐛 Troubleshooting

### "relation v_conversations_analytics does not exist"
El SQL no se aplicó. Re-corre `2026_sprint_10.sql`.

### Dashboard vacío aunque corriste el seed
Verifica:
```sql
SELECT COUNT(*), status FROM conversations 
WHERE metadata->>'seed' = 'true' 
GROUP BY status;
```
Debe devolver 4 filas (open/pending/resolved/abandoned).

### "Sin actividad de agentes en este período"
Los seed usan agentes existentes. Si solo tienes 1 agente, aparecerá solo ese.

### Build falla con TS errors
Lo más probable: falta importar `SupervisorAlerts` o tipos viejos. Pégame el error.

### El selector de Equipo no aparece
Es esperado si no tienes tabla `teams` en la DB. El repo maneja ese caso con warning silencioso.

### CSV no descarga en Safari
Tiene un bug conocido. Funciona en Chrome/Firefox/Edge sin problema.

---

## 🔐 Permisos RBAC

| Rol | analytics.read | analytics.export |
|---|---|---|
| agent | ❌ | ❌ |
| supervisor | ✅ team | ✅ team |
| admin | ✅ all | ✅ all |
| super_admin | ✅ all | ✅ all |

Si un agent común intenta ir a `/admin/analytics`, lo redirige a dashboard.

---

## 💾 Commit sugerido

```bash
cd C:\xampp\htdocs\proyectos\chatbot
git add -A
git commit -m "feat(sprint-10): Agent Analytics dashboard completo

SQL:
- Vista v_conversations_analytics (base para queries)
- Vista v_agent_metrics (agregados por agente)
- RPC get_heatmap_data (día × hora)
- 2 permisos: analytics.read / analytics.export
- Seed de 50 conversaciones fake para demo

Frontend:
- Vista /admin/analytics con 4 tabs
- DateRangePicker con 10 presets + custom
- 6 filtros: fecha, agente, canal, estado, prioridad, equipo
- 7 gráficos SVG puros (sin libs):
  * Línea volumen con comparativo período anterior
  * Dona 4 estados
  * Barras horizontales top 5 agentes
  * Radar pentágono por agente
  * Heatmap 7×24 horas
  * Bubble FRT vs volumen
  * Leaderboard preview
- Tab Leaderboard con 🥇🥈🥉
- Tab Horarios fullsize
- Tab Comparativo período vs anterior
- Export CSV (conversaciones + agentes)

Agent Workspace completo: cuadrantes A, B, C y D implementados."

git push
```

---

## ✅ Agent Workspace COMPLETO

```
[✅] Cuadrante A (Gestión)       · Sprint 7.5 + 8
[✅] Cuadrante B (Mi workspace)  · Sprint 8
[✅] Cuadrante C (Supervisor)    · Sprint 9
[✅] Cuadrante D (Analytics)     · Sprint 10 ← ESTE
```

---

## 🚀 ¿Qué sigue?

Con el Agent Workspace terminado, las opciones son:

1. **Pre-chat widget** (Entrega 2.5 pendiente de Sprint 7.5)
2. **Sprint 11: Settings avanzado** (branding, notificaciones, integraciones)
3. **Sprint 12: Email invitaciones** (flujo completo con templates)
4. **Sprint 13: Telegram** (2do canal)
5. **Sprint 14: Landing comercial** (lorachat.net)
6. **Sprint 15: Stripe billing** (monetización)
7. **Sprint 16: Constructor visual de flujos**
8. **Sprint 17: WhatsApp Business API**
