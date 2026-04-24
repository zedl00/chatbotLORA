-- ═══════════════════════════════════════════════════════════════
-- Sprint 8 · Entrega 4 · SQL
--
-- Alcance:
--   1. Permisos nuevos: quick_replies.read/create/update/delete/share
--   2. RPC: increment_quick_reply_usage (analytics)
--   3. Cron: auto_away cada 2 min (requiere pg_cron)
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. Permisos para quick_replies
-- ─────────────────────────────────────────────────────────────
INSERT INTO permissions (key, resource, action, description, scopeable, category, is_dangerous, sort_order)
VALUES
  ('quick_replies.read',   'quick_replies', 'read',   'Ver snippets propios y compartidos',   false, 'productivity', false, 300),
  ('quick_replies.create', 'quick_replies', 'create', 'Crear snippets personales',            false, 'productivity', false, 301),
  ('quick_replies.update', 'quick_replies', 'update', 'Editar snippets propios',              false, 'productivity', false, 302),
  ('quick_replies.delete', 'quick_replies', 'delete', 'Eliminar snippets propios',            false, 'productivity', false, 303),
  ('quick_replies.share',  'quick_replies', 'share',  'Crear/editar snippets compartidos del equipo', false, 'productivity', true, 304)
ON CONFLICT (key) DO NOTHING;


-- ─────────────────────────────────────────────────────────────
-- 2. Asignar permisos a roles de sistema
--    - agent: read, create, update (propios), delete (propios)
--    - supervisor: todo lo anterior + share
--    - admin: todo + share
--    - super_admin: ya tiene wildcard '*'
-- ─────────────────────────────────────────────────────────────

-- Helper: insertar permiso en rol si no está ya
DO $$
DECLARE
  v_agent_role UUID;
  v_supervisor_role UUID;
  v_admin_role UUID;
  v_perm_id UUID;
  v_perm_key TEXT;
  v_perms_basic TEXT[] := ARRAY['quick_replies.read', 'quick_replies.create', 'quick_replies.update', 'quick_replies.delete'];
  v_perm_share TEXT := 'quick_replies.share';
BEGIN
  -- Buscar roles del sistema (is_system = true, organization_id = null)
  SELECT id INTO v_agent_role      FROM roles WHERE is_system = true AND key = 'agent'      LIMIT 1;
  SELECT id INTO v_supervisor_role FROM roles WHERE is_system = true AND key = 'supervisor' LIMIT 1;
  SELECT id INTO v_admin_role      FROM roles WHERE is_system = true AND key = 'admin'      LIMIT 1;

  -- Agent: permisos básicos
  IF v_agent_role IS NOT NULL THEN
    FOREACH v_perm_key IN ARRAY v_perms_basic LOOP
      SELECT id INTO v_perm_id FROM permissions WHERE key = v_perm_key;
      IF v_perm_id IS NOT NULL THEN
        INSERT INTO role_permissions (role_id, permission_id, scope)
        VALUES (v_agent_role, v_perm_id, 'own')
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  -- Supervisor: básicos + share
  IF v_supervisor_role IS NOT NULL THEN
    FOREACH v_perm_key IN ARRAY v_perms_basic || ARRAY[v_perm_share] LOOP
      SELECT id INTO v_perm_id FROM permissions WHERE key = v_perm_key;
      IF v_perm_id IS NOT NULL THEN
        INSERT INTO role_permissions (role_id, permission_id, scope)
        VALUES (v_supervisor_role, v_perm_id, 'team')
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  -- Admin: básicos + share con scope 'all'
  IF v_admin_role IS NOT NULL THEN
    FOREACH v_perm_key IN ARRAY v_perms_basic || ARRAY[v_perm_share] LOOP
      SELECT id INTO v_perm_id FROM permissions WHERE key = v_perm_key;
      IF v_perm_id IS NOT NULL THEN
        INSERT INTO role_permissions (role_id, permission_id, scope)
        VALUES (v_admin_role, v_perm_id, 'all')
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────
-- 3. RPC para incrementar usage_count (analytics)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_quick_reply_usage(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  UPDATE quick_replies
  SET usage_count = usage_count + 1
  WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_quick_reply_usage(UUID) TO authenticated;


-- ─────────────────────────────────────────────────────────────
-- 4. Cron para auto_away cada 2 minutos
--
-- NOTA: requiere extensión pg_cron. En Supabase hay que habilitarla
-- desde Dashboard → Database → Extensions → buscar "pg_cron" → enable.
--
-- Si no está habilitada o si no la quieres usar (ej. plan free), comenta
-- este bloque y no pasa nada. El auto_away seguirá funcionando cuando
-- el usuario se haga heartbeat manualmente.
-- ─────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Eliminar job si existe (para re-ejecutar sin error)
    PERFORM cron.unschedule('lora_auto_away_agents')
    WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'lora_auto_away_agents'
    );

    -- Programar: cada 2 minutos marcar 'away' a quienes tienen >5 min sin heartbeat
    PERFORM cron.schedule(
      'lora_auto_away_agents',
      '*/2 * * * *',
      $CRON$ SELECT agents_auto_away(5) $CRON$
    );

    RAISE NOTICE 'Cron pg_cron programado: lora_auto_away_agents cada 2 min';
  ELSE
    RAISE NOTICE 'pg_cron NO está habilitado. El cron de auto_away no se programó.';
    RAISE NOTICE 'Para habilitarlo: Dashboard → Database → Extensions → pg_cron → Enable';
  END IF;
END $$;


COMMIT;


-- ─────────────────────────────────────────────────────────────
-- Verificaciones
-- ─────────────────────────────────────────────────────────────

-- 1) Permisos creados
SELECT 'permisos_quick_replies' AS check_,
       COUNT(*) AS count_,
       string_agg(key, ', ' ORDER BY key) AS keys_
FROM permissions
WHERE resource = 'quick_replies';

-- 2) RPC existe
SELECT 'rpc_increment_usage' AS check_,
       EXISTS (
         SELECT 1 FROM information_schema.routines
         WHERE routine_name = 'increment_quick_reply_usage'
       ) AS exists_;

-- 3) Roles asignados (cuántos role_permissions tienen quick_replies)
SELECT 'role_permissions_asignados' AS check_,
       COUNT(*) AS count_
FROM role_permissions rp
INNER JOIN permissions p ON p.id = rp.permission_id
WHERE p.resource = 'quick_replies';

-- 4) Cron programado (solo si pg_cron existe)
SELECT 'cron_programado' AS check_,
       EXISTS (
         SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
       ) AS pg_cron_available;
