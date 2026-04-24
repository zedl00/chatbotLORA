-- ═══════════════════════════════════════════════════════════════
-- Sprint 7.5 + 8 · Entrega 1 · Foundation SQL
--
-- Alcance:
--   1. Tabla quick_replies (personal + compartida)
--   2. Columnas nuevas en agents para heartbeat
--   3. Índices útiles
--   4. RLS policies
--
-- NO se toca:
--   - Tabla agents (ya está perfecta)
--   - Tabla contacts (ya está perfecta)
--   - Tabla teams (ya está perfecta)
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. Columna last_activity_at en agents
--    Para detección automática de "away" tras N minutos
-- ─────────────────────────────────────────────────────────────
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT NOW();

-- Índice para queries frecuentes de "quién está activo"
CREATE INDEX IF NOT EXISTS idx_agents_last_activity
  ON agents(organization_id, last_activity_at DESC);


-- ─────────────────────────────────────────────────────────────
-- 2. Tabla quick_replies
--    Snippets que el agente inserta con "/" en el editor.
--    Si is_shared = true, todo el equipo las ve.
--    Si is_shared = false, solo el autor (owner_id) las ve.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quick_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  shortcut VARCHAR(50) NOT NULL,           -- ej: "saludo", "despedida"
  title VARCHAR(100) NOT NULL,              -- descripción visible
  content TEXT NOT NULL,                    -- el texto a insertar
  category VARCHAR(50),                     -- opcional: saludo, despedida, pago, técnico

  is_shared BOOLEAN NOT NULL DEFAULT false, -- false = personal, true = compartida
  usage_count INTEGER NOT NULL DEFAULT 0,   -- analytics: cuántas veces se ha usado

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice: shortcut único por organización + owner (para no duplicar)
CREATE UNIQUE INDEX IF NOT EXISTS idx_quick_replies_shortcut_unique
  ON quick_replies(organization_id, owner_id, shortcut);

-- Índice: búsqueda rápida por org
CREATE INDEX IF NOT EXISTS idx_quick_replies_org
  ON quick_replies(organization_id, is_shared);

-- Índice: para búsquedas del agente (sus personales + compartidas)
CREATE INDEX IF NOT EXISTS idx_quick_replies_owner
  ON quick_replies(owner_id, is_shared);


-- ─────────────────────────────────────────────────────────────
-- 3. RLS Policies para quick_replies
-- ─────────────────────────────────────────────────────────────
ALTER TABLE quick_replies ENABLE ROW LEVEL SECURITY;

-- SELECT: el usuario ve sus propias + las compartidas de su org
DROP POLICY IF EXISTS "quick_replies_select_own_or_shared" ON quick_replies;
CREATE POLICY "quick_replies_select_own_or_shared" ON quick_replies
  FOR SELECT
  USING (
    organization_id = (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND (
      owner_id = auth.uid()      -- mis propias
      OR is_shared = true         -- o compartidas de mi org
    )
  );

-- INSERT: solo puedo crear quick replies para mi org
DROP POLICY IF EXISTS "quick_replies_insert_own" ON quick_replies;
CREATE POLICY "quick_replies_insert_own" ON quick_replies
  FOR INSERT
  WITH CHECK (
    organization_id = (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND owner_id = auth.uid()
  );

-- UPDATE: solo puedo editar las mías (incluso si son compartidas)
DROP POLICY IF EXISTS "quick_replies_update_own" ON quick_replies;
CREATE POLICY "quick_replies_update_own" ON quick_replies
  FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- DELETE: solo puedo borrar las mías
DROP POLICY IF EXISTS "quick_replies_delete_own" ON quick_replies;
CREATE POLICY "quick_replies_delete_own" ON quick_replies
  FOR DELETE
  USING (owner_id = auth.uid());


-- ─────────────────────────────────────────────────────────────
-- 4. Trigger: auto-update de updated_at
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_quick_replies_updated_at ON quick_replies;
CREATE TRIGGER trg_quick_replies_updated_at
  BEFORE UPDATE ON quick_replies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ─────────────────────────────────────────────────────────────
-- 5. RPC: Actualizar last_activity_at del agente (heartbeat)
--    Se llama desde el frontend cada 60 segundos.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION agent_heartbeat(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE agents
  SET
    last_activity_at = NOW(),
    -- Si estaba 'away' u 'offline' y escribió heartbeat, pasa a 'online'
    status = CASE
      WHEN status IN ('away', 'offline') THEN 'online'::agent_status
      ELSE status
    END
  WHERE user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION agent_heartbeat(UUID) TO authenticated;


-- ─────────────────────────────────────────────────────────────
-- 6. RPC: Cambiar estado del agente manualmente
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION agent_set_status(
  p_user_id UUID,
  p_status TEXT,
  p_status_message TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validar que el estado sea válido (enum)
  IF p_status NOT IN ('online', 'busy', 'away', 'offline') THEN
    RAISE EXCEPTION 'Invalid status: %. Must be online/busy/away/offline', p_status;
  END IF;

  UPDATE agents
  SET
    status = p_status::agent_status,
    status_message = p_status_message,
    status_changed_at = NOW(),
    last_activity_at = NOW()
  WHERE user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION agent_set_status(UUID, TEXT, TEXT) TO authenticated;


-- ─────────────────────────────────────────────────────────────
-- 7. RPC: Auto-mark agents as "away" after inactivity
--    Se puede llamar desde un cron o manualmente.
--    Un agent que no tuvo heartbeat en los últimos N minutos → 'away'.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION agents_auto_away(p_minutes INTEGER DEFAULT 5)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected_count INTEGER;
BEGIN
  UPDATE agents
  SET
    status = 'away'::agent_status,
    status_changed_at = NOW()
  WHERE
    status = 'online'::agent_status
    AND last_activity_at < NOW() - (p_minutes || ' minutes')::INTERVAL;

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RETURN affected_count;
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- 8. Vista: v_agents_live (agentes con info agregada)
--    Útil para el sidebar y la vista AgentsView
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_agents_live AS
SELECT
  a.id AS agent_id,
  a.user_id,
  a.organization_id,
  a.team_id,
  a.status,
  a.status_message,
  a.status_changed_at,
  a.last_activity_at,
  a.max_concurrent_chats,
  a.auto_assign,
  a.skills,
  u.email,
  u.full_name,
  u.avatar_url,
  u.active AS user_active,
  t.name AS team_name,
  t.color AS team_color,
  -- Conversaciones activas del agente
  COALESCE((
    SELECT COUNT(*)
    FROM conversations c
    WHERE c.agent_id = a.user_id
      AND c.status IN ('open', 'pending')
  ), 0) AS active_conversations,
  -- ¿Está al máximo de capacidad?
  CASE
    WHEN a.max_concurrent_chats > 0 AND (
      SELECT COUNT(*)
      FROM conversations c
      WHERE c.agent_id = a.user_id
        AND c.status IN ('open', 'pending')
    ) >= a.max_concurrent_chats THEN true
    ELSE false
  END AS at_capacity
FROM agents a
INNER JOIN users u ON u.id = a.user_id
LEFT JOIN teams t ON t.id = a.team_id
WHERE u.active = true;


-- ─────────────────────────────────────────────────────────────
-- 9. Auto-crear agent record cuando se crea un user con role agent/supervisor
--    (Opcional pero útil para que no olvidemos crearlos)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION ensure_agent_record()
RETURNS TRIGGER AS $$
BEGIN
  -- Si el user tiene role agent o supervisor Y no existe su registro en agents
  IF NEW.role IN ('agent', 'supervisor') THEN
    INSERT INTO agents (user_id, organization_id, status)
    VALUES (NEW.id, NEW.organization_id, 'offline')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Índice único en user_id si no existe (requerido para ON CONFLICT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'agents' AND indexname = 'idx_agents_user_id_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_agents_user_id_unique ON agents(user_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_ensure_agent_record ON users;
CREATE TRIGGER trg_ensure_agent_record
  AFTER INSERT OR UPDATE OF role ON users
  FOR EACH ROW
  EXECUTE FUNCTION ensure_agent_record();


-- ─────────────────────────────────────────────────────────────
-- 10. Backfill: crear agent record para users existentes con role agent/supervisor
-- ─────────────────────────────────────────────────────────────
INSERT INTO agents (user_id, organization_id, status)
SELECT u.id, u.organization_id, 'offline'
FROM users u
WHERE u.role IN ('agent', 'supervisor')
  AND NOT EXISTS (SELECT 1 FROM agents a WHERE a.user_id = u.id)
ON CONFLICT (user_id) DO NOTHING;


COMMIT;

-- ─────────────────────────────────────────────────────────────
-- Verificaciones finales (queries de control, no rompen)
-- ─────────────────────────────────────────────────────────────

-- 1) Confirmar tabla quick_replies creada
SELECT 'quick_replies' AS tabla, COUNT(*) AS columnas
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'quick_replies';

-- 2) Confirmar columna last_activity_at en agents
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'agents'
  AND column_name = 'last_activity_at';

-- 3) Confirmar RPCs creadas
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('agent_heartbeat', 'agent_set_status', 'agents_auto_away');

-- 4) Ver cuántos agentes hay tras backfill
SELECT COUNT(*) AS agentes_totales FROM agents;

-- 5) Confirmar vista creada
SELECT 'v_agents_live' AS vista, COUNT(*) AS columnas
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'v_agents_live';
