-- ═══════════════════════════════════════════════════════════════
-- Sprint 11.5 · Channels Dashboard
--
-- Contenido:
--   1. Vista v_channel_metrics (conv count, CSAT, last activity)
--   2. Permiso channels.delete (seguridad extra para borrar)
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. Vista: métricas por canal (30 días)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_channel_metrics AS
SELECT
  ch.id AS channel_id,
  ch.organization_id,
  ch.name,
  ch.type,
  ch.active,
  ch.created_at,
  -- Totales (todo el historial)
  (SELECT COUNT(*) FROM conversations c WHERE c.channel_id = ch.id) AS total_conversations,
  (SELECT MAX(created_at) FROM conversations c WHERE c.channel_id = ch.id) AS last_activity_at,
  -- Últimos 30 días
  (SELECT COUNT(*) FROM conversations c
   WHERE c.channel_id = ch.id
     AND c.created_at >= NOW() - INTERVAL '30 days') AS conversations_30d,
  -- CSAT promedio (últimos 30 días con rating)
  (SELECT ROUND(AVG(csat_score)::numeric, 2) FROM conversations c
   WHERE c.channel_id = ch.id
     AND c.csat_score IS NOT NULL
     AND c.created_at >= NOW() - INTERVAL '30 days') AS avg_csat_30d,
  (SELECT COUNT(csat_score) FROM conversations c
   WHERE c.channel_id = ch.id
     AND c.csat_score IS NOT NULL
     AND c.created_at >= NOW() - INTERVAL '30 days') AS csat_count_30d
FROM channels ch;

GRANT SELECT ON v_channel_metrics TO authenticated;


-- ─────────────────────────────────────────────────────────────
-- 2. Permiso delete (granular, más seguro)
-- ─────────────────────────────────────────────────────────────
INSERT INTO permissions (key, resource, action, description, scopeable, category, is_dangerous, sort_order)
VALUES
  ('channels.delete', 'channels', 'delete', 'Eliminar canales', false, 'channels', true, 320)
ON CONFLICT (key) DO NOTHING;

DO $$
DECLARE
  v_admin_role UUID;
  v_perm_id UUID;
BEGIN
  SELECT id INTO v_admin_role FROM roles WHERE is_system = true AND key = 'admin' LIMIT 1;
  SELECT id INTO v_perm_id FROM permissions WHERE key = 'channels.delete';

  IF v_admin_role IS NOT NULL AND v_perm_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id, scope)
    VALUES (v_admin_role, v_perm_id, 'all') ON CONFLICT DO NOTHING;
  END IF;
END $$;


COMMIT;


-- ─────────────────────────────────────────────────────────────
-- Verificaciones
-- ─────────────────────────────────────────────────────────────
SELECT 'vista_metrics' AS check_, EXISTS (
  SELECT 1 FROM information_schema.views WHERE table_name = 'v_channel_metrics'
) AS exists_;

SELECT 'permission_delete' AS check_, EXISTS (
  SELECT 1 FROM permissions WHERE key = 'channels.delete'
) AS exists_;

-- Preview de tus canales con métricas
SELECT channel_id, name, type, active, total_conversations, conversations_30d, avg_csat_30d, last_activity_at
FROM v_channel_metrics
ORDER BY created_at;
