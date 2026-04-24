-- ═══════════════════════════════════════════════════════════════
-- Sprint 9 · Supervisor Tools
--
-- Contenido:
--   1. sender_type 'whisper' + 'system' (CHECK constraint)
--   2. Tabla sla_configs (1 por org)
--   3. Tabla escalations (eventos: sla_breach, takeover, reassign)
--   4. RPC detect_sla_breaches() — usa conversations.sla_due_at
--   5. RPC supervisor_takeover(conv_id)
--   6. RPC send_whisper(conv_id, content)
--   7. RPC reassign_conversation(conv_id, new_agent_id)
--   8. Permisos: conversations.takeover, .whisper, .reassign, .sla_config
--   9. Cron pg_cron cada 1 min
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. sender_type — agregar valores válidos (si no es enum)
-- Tu sender_type es text, así que no podemos alterar enum.
-- Si ya tienes un CHECK, lo reemplazamos. Si no, lo creamos.
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_check_name TEXT;
BEGIN
  -- Buscar check constraint existente sobre sender_type
  SELECT conname INTO v_check_name
  FROM pg_constraint
  WHERE conrelid = 'messages'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%sender_type%'
  LIMIT 1;

  IF v_check_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE messages DROP CONSTRAINT %I', v_check_name);
    RAISE NOTICE 'Dropped check constraint: %', v_check_name;
  END IF;

  -- Agregar el nuevo CHECK con whisper y system
  ALTER TABLE messages
    ADD CONSTRAINT messages_sender_type_check
    CHECK (sender_type IN ('contact', 'agent', 'bot', 'whisper', 'system'));

  RAISE NOTICE 'Added check constraint: sender_type IN (contact, agent, bot, whisper, system)';
END $$;


-- ─────────────────────────────────────────────────────────────
-- 2. Tabla sla_configs
-- Una fila por org. Si no existe, se usan defaults.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sla_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,

  -- SLA de primer respuesta del agente (en minutos)
  first_response_minutes INTEGER NOT NULL DEFAULT 5 CHECK (first_response_minutes BETWEEN 1 AND 1440),

  -- Resolution SLA (opcional, para Sprint 10)
  resolution_minutes INTEGER CHECK (resolution_minutes BETWEEN 1 AND 10080),

  -- Si un supervisor debe ser notificado
  notify_supervisors BOOLEAN NOT NULL DEFAULT true,

  -- Activar/desactivar SLA monitoring para esta org
  enabled BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sla_configs_org ON sla_configs(organization_id);

ALTER TABLE sla_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sla_configs_select ON sla_configs;
CREATE POLICY sla_configs_select ON sla_configs FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS sla_configs_insert ON sla_configs;
CREATE POLICY sla_configs_insert ON sla_configs FOR INSERT
  WITH CHECK (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS sla_configs_update ON sla_configs;
CREATE POLICY sla_configs_update ON sla_configs FOR UPDATE
  USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));


-- ─────────────────────────────────────────────────────────────
-- 3. Tabla escalations
-- Registro histórico de eventos: breach, takeover, reassign
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,

  -- Tipo de evento
  type TEXT NOT NULL CHECK (type IN ('sla_breach', 'takeover', 'reassign')),

  -- Actor: quién disparó el evento (user_id de la tabla users)
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Para takeover/reassign: el agente afectado (users.id)
  from_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Resolución del evento
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Data extra
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escalations_org ON escalations(organization_id);
CREATE INDEX IF NOT EXISTS idx_escalations_conv ON escalations(conversation_id);
CREATE INDEX IF NOT EXISTS idx_escalations_unresolved
  ON escalations(organization_id, type) WHERE resolved = false;
CREATE INDEX IF NOT EXISTS idx_escalations_created ON escalations(organization_id, created_at DESC);

ALTER TABLE escalations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS escalations_select ON escalations;
CREATE POLICY escalations_select ON escalations FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS escalations_insert ON escalations;
CREATE POLICY escalations_insert ON escalations FOR INSERT
  WITH CHECK (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS escalations_update ON escalations;
CREATE POLICY escalations_update ON escalations FOR UPDATE
  USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));


-- ─────────────────────────────────────────────────────────────
-- 4. RPC: detect_sla_breaches
-- Recorre conversaciones OPEN con sla_due_at pasado,
-- marca sla_breached y crea eventos de escalation.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION detect_sla_breaches()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER := 0;
  v_conv RECORD;
BEGIN
  FOR v_conv IN
    SELECT c.id, c.organization_id, c.agent_id, a.user_id AS agent_user_id
    FROM conversations c
    LEFT JOIN agents a ON a.id = c.agent_id
    INNER JOIN sla_configs sc ON sc.organization_id = c.organization_id AND sc.enabled = true
    WHERE c.status = 'open'
      AND c.sla_due_at IS NOT NULL
      AND c.sla_due_at < NOW()
      AND (c.sla_breached IS NULL OR c.sla_breached = false)
  LOOP
    -- Marcar como breached
    UPDATE conversations SET sla_breached = true WHERE id = v_conv.id;

    -- Crear el escalation si no existe ya uno activo
    INSERT INTO escalations (
      organization_id, conversation_id, type, from_user_id, metadata
    )
    SELECT
      v_conv.organization_id,
      v_conv.id,
      'sla_breach',
      v_conv.agent_user_id,
      jsonb_build_object('detected_at', NOW())
    WHERE NOT EXISTS (
      SELECT 1 FROM escalations
      WHERE conversation_id = v_conv.id
        AND type = 'sla_breach'
        AND resolved = false
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION detect_sla_breaches() TO authenticated;


-- ─────────────────────────────────────────────────────────────
-- 5. RPC: supervisor_takeover
-- El supervisor toma el control: reasigna al agente del supervisor,
-- crea evento, resuelve escalamientos SLA activos, inserta mensaje system.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION supervisor_takeover(p_conversation_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_supervisor_user_id UUID;
  v_supervisor_agent_id UUID;
  v_old_agent_id UUID;
  v_old_agent_user_id UUID;
  v_org_id UUID;
  v_escalation_id UUID;
BEGIN
  v_supervisor_user_id := auth.uid();
  IF v_supervisor_user_id IS NULL THEN
    RAISE EXCEPTION 'No hay usuario autenticado';
  END IF;

  -- Obtener datos de la conversación
  SELECT c.organization_id, c.agent_id, a.user_id
  INTO v_org_id, v_old_agent_id, v_old_agent_user_id
  FROM conversations c
  LEFT JOIN agents a ON a.id = c.agent_id
  WHERE c.id = p_conversation_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Conversación no encontrada';
  END IF;

  -- Obtener el agent_id del supervisor (que también debe ser agent)
  SELECT id INTO v_supervisor_agent_id
  FROM agents WHERE user_id = v_supervisor_user_id;

  IF v_supervisor_agent_id IS NULL THEN
    RAISE EXCEPTION 'El supervisor no tiene registro en agents';
  END IF;

  -- Reasignar la conversación al supervisor
  UPDATE conversations
  SET agent_id = v_supervisor_agent_id,
      assigned_at = NOW(),
      updated_at = NOW()
  WHERE id = p_conversation_id;

  -- Crear escalation de takeover
  INSERT INTO escalations (
    organization_id, conversation_id, type, actor_id, from_user_id, to_user_id, metadata
  ) VALUES (
    v_org_id, p_conversation_id, 'takeover',
    v_supervisor_user_id, v_old_agent_user_id, v_supervisor_user_id,
    jsonb_build_object('reason', 'supervisor_takeover')
  )
  RETURNING id INTO v_escalation_id;

  -- Resolver escalamientos SLA previos
  UPDATE escalations
  SET resolved = true, resolved_at = NOW(), resolved_by = v_supervisor_user_id
  WHERE conversation_id = p_conversation_id
    AND type = 'sla_breach'
    AND resolved = false;

  -- Mensaje del sistema
  INSERT INTO messages (
    conversation_id, organization_id, sender_type, content, content_type, status
  ) VALUES (
    p_conversation_id, v_org_id, 'system',
    'Un supervisor tomó el control de esta conversación.',
    'text', 'delivered'
  );

  RETURN v_escalation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION supervisor_takeover(UUID) TO authenticated;


-- ─────────────────────────────────────────────────────────────
-- 6. RPC: send_whisper
-- Envía un mensaje tipo 'whisper' visible solo al equipo interno.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION send_whisper(
  p_conversation_id UUID,
  p_content TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_agent_id UUID;
  v_org_id UUID;
  v_msg_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF p_content IS NULL OR trim(p_content) = '' THEN
    RAISE EXCEPTION 'El contenido no puede estar vacío';
  END IF;

  SELECT organization_id INTO v_org_id FROM conversations WHERE id = p_conversation_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Conversación no encontrada';
  END IF;

  SELECT id INTO v_agent_id FROM agents WHERE user_id = v_user_id;

  INSERT INTO messages (
    conversation_id, organization_id, sender_type, sender_agent_id,
    content, content_type, status, metadata
  ) VALUES (
    p_conversation_id, v_org_id, 'whisper', v_agent_id,
    p_content, 'text', 'delivered',
    jsonb_build_object('author_user_id', v_user_id)
  )
  RETURNING id INTO v_msg_id;

  RETURN v_msg_id;
END;
$$;

GRANT EXECUTE ON FUNCTION send_whisper(UUID, TEXT) TO authenticated;


-- ─────────────────────────────────────────────────────────────
-- 7. RPC: reassign_conversation
-- Reasigna la conversación a otro agente. Crea escalation de reassign
-- e inserta mensaje de system.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION reassign_conversation(
  p_conversation_id UUID,
  p_new_agent_id UUID  -- agents.id, no users.id
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_actor_user_id UUID;
  v_old_agent_id UUID;
  v_old_agent_user_id UUID;
  v_new_agent_user_id UUID;
  v_new_agent_name TEXT;
  v_org_id UUID;
  v_escalation_id UUID;
BEGIN
  v_actor_user_id := auth.uid();
  IF v_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  -- Datos de la conversación
  SELECT c.organization_id, c.agent_id, a.user_id
  INTO v_org_id, v_old_agent_id, v_old_agent_user_id
  FROM conversations c
  LEFT JOIN agents a ON a.id = c.agent_id
  WHERE c.id = p_conversation_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Conversación no encontrada';
  END IF;

  -- Datos del nuevo agente
  SELECT a.user_id, u.full_name
  INTO v_new_agent_user_id, v_new_agent_name
  FROM agents a
  JOIN users u ON u.id = a.user_id
  WHERE a.id = p_new_agent_id AND a.organization_id = v_org_id;

  IF v_new_agent_user_id IS NULL THEN
    RAISE EXCEPTION 'Agente destino no encontrado o pertenece a otra org';
  END IF;

  -- Reasignar
  UPDATE conversations
  SET agent_id = p_new_agent_id,
      assigned_at = NOW(),
      updated_at = NOW()
  WHERE id = p_conversation_id;

  -- Escalation
  INSERT INTO escalations (
    organization_id, conversation_id, type, actor_id, from_user_id, to_user_id, metadata
  ) VALUES (
    v_org_id, p_conversation_id, 'reassign',
    v_actor_user_id, v_old_agent_user_id, v_new_agent_user_id,
    jsonb_build_object('reason', 'manual_reassign')
  )
  RETURNING id INTO v_escalation_id;

  -- Resolver breaches activos
  UPDATE escalations
  SET resolved = true, resolved_at = NOW(), resolved_by = v_actor_user_id
  WHERE conversation_id = p_conversation_id
    AND type = 'sla_breach'
    AND resolved = false;

  -- Mensaje del sistema
  INSERT INTO messages (
    conversation_id, organization_id, sender_type, content, content_type, status
  ) VALUES (
    p_conversation_id, v_org_id, 'system',
    format('Conversación reasignada a %s.', COALESCE(v_new_agent_name, 'agente')),
    'text', 'delivered'
  );

  RETURN v_escalation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION reassign_conversation(UUID, UUID) TO authenticated;


-- ─────────────────────────────────────────────────────────────
-- 8. Trigger: calcular sla_due_at automáticamente al asignar agente
-- Se setea cuando handoff_at se llena (conversación pasa a humano).
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_sla_due_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_minutes INTEGER;
BEGIN
  -- Solo si estamos pasando handoff_at de NULL a un valor Y sla_due_at es NULL
  IF NEW.handoff_at IS NOT NULL
     AND (OLD.handoff_at IS NULL OR OLD.handoff_at IS DISTINCT FROM NEW.handoff_at)
     AND NEW.sla_due_at IS NULL THEN

    SELECT COALESCE(first_response_minutes, 5) INTO v_minutes
    FROM sla_configs
    WHERE organization_id = NEW.organization_id
      AND enabled = true;

    IF v_minutes IS NOT NULL THEN
      NEW.sla_due_at := NEW.handoff_at + (v_minutes || ' minutes')::interval;
    END IF;
  END IF;

  -- Si first_response_at se llena, resolver sla (ya respondió a tiempo o tarde, pero respondió)
  IF NEW.first_response_at IS NOT NULL AND (OLD.first_response_at IS NULL) THEN
    -- Si había escalation de sla_breach sin resolver, se resuelve automático
    UPDATE escalations
    SET resolved = true, resolved_at = NOW()
    WHERE conversation_id = NEW.id
      AND type = 'sla_breach'
      AND resolved = false;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_sla_due_at ON conversations;
CREATE TRIGGER trg_set_sla_due_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION set_sla_due_at();


-- ─────────────────────────────────────────────────────────────
-- 9. Trigger: cuando un agente envía un mensaje, setear first_response_at
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_first_response_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.sender_type = 'agent' THEN
    UPDATE conversations
    SET first_response_at = COALESCE(first_response_at, NEW.created_at)
    WHERE id = NEW.conversation_id
      AND first_response_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_first_response_at ON messages;
CREATE TRIGGER trg_set_first_response_at
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION set_first_response_at();


-- ─────────────────────────────────────────────────────────────
-- 10. Permisos RBAC
-- ─────────────────────────────────────────────────────────────
INSERT INTO permissions (key, resource, action, description, scopeable, category, is_dangerous, sort_order)
VALUES
  ('conversations.takeover',  'conversations', 'takeover', 'Tomar control de una conversación de otro agente',          false, 'supervision', true, 400),
  ('conversations.whisper',   'conversations', 'whisper',  'Enviar mensajes privados visibles solo al equipo interno',   false, 'supervision', false, 401),
  ('conversations.reassign',  'conversations', 'reassign', 'Reasignar conversaciones a otros agentes',                    false, 'supervision', false, 402),
  ('sla_config.read',         'sla_config',    'read',     'Ver configuración de SLA',                                    false, 'supervision', false, 410),
  ('sla_config.update',       'sla_config',    'update',   'Cambiar configuración de SLA',                                false, 'supervision', true, 411),
  ('escalations.read',        'escalations',   'read',     'Ver notificaciones de escalamientos',                         false, 'supervision', false, 420)
ON CONFLICT (key) DO NOTHING;

-- Asignar permisos a supervisor y admin (no al agent común)
DO $$
DECLARE
  v_supervisor_role UUID;
  v_admin_role UUID;
  v_perm_id UUID;
  v_perm_key TEXT;
  v_perms_supervisor TEXT[] := ARRAY[
    'conversations.takeover',
    'conversations.whisper',
    'conversations.reassign',
    'sla_config.read',
    'escalations.read'
  ];
  v_perms_admin TEXT[] := ARRAY[
    'conversations.takeover',
    'conversations.whisper',
    'conversations.reassign',
    'sla_config.read',
    'sla_config.update',
    'escalations.read'
  ];
BEGIN
  SELECT id INTO v_supervisor_role FROM roles WHERE is_system = true AND key = 'supervisor' LIMIT 1;
  SELECT id INTO v_admin_role      FROM roles WHERE is_system = true AND key = 'admin'      LIMIT 1;

  IF v_supervisor_role IS NOT NULL THEN
    FOREACH v_perm_key IN ARRAY v_perms_supervisor LOOP
      SELECT id INTO v_perm_id FROM permissions WHERE key = v_perm_key;
      IF v_perm_id IS NOT NULL THEN
        INSERT INTO role_permissions (role_id, permission_id, scope)
        VALUES (v_supervisor_role, v_perm_id, 'team')
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  IF v_admin_role IS NOT NULL THEN
    FOREACH v_perm_key IN ARRAY v_perms_admin LOOP
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
-- 11. Seed: crear sla_configs para orgs existentes
-- ─────────────────────────────────────────────────────────────
INSERT INTO sla_configs (organization_id, first_response_minutes, notify_supervisors, enabled)
SELECT id, 5, true, true FROM organizations
WHERE id NOT IN (SELECT organization_id FROM sla_configs)
ON CONFLICT (organization_id) DO NOTHING;


-- ─────────────────────────────────────────────────────────────
-- 12. Cron pg_cron: detectar breaches cada 1 min
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('lora_detect_sla_breaches')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'lora_detect_sla_breaches');

    PERFORM cron.schedule(
      'lora_detect_sla_breaches',
      '* * * * *',
      $CRON$ SELECT detect_sla_breaches() $CRON$
    );

    RAISE NOTICE 'Cron lora_detect_sla_breaches programado (cada 1 min)';
  ELSE
    RAISE NOTICE 'pg_cron NO disponible; el detector de SLA no se programó';
  END IF;
END $$;


COMMIT;


-- ─────────────────────────────────────────────────────────────
-- Verificaciones
-- ─────────────────────────────────────────────────────────────
SELECT 'sla_configs_created' AS check_, COUNT(*) AS count_ FROM sla_configs;
SELECT 'escalations_table'   AS check_,
       EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'escalations') AS exists_;
SELECT 'rpcs'                AS check_,
       (SELECT COUNT(*) FROM information_schema.routines
        WHERE routine_name IN ('detect_sla_breaches', 'supervisor_takeover', 'send_whisper', 'reassign_conversation')) AS rpc_count;
SELECT 'permissions'         AS check_,
       (SELECT COUNT(*) FROM permissions
        WHERE key IN ('conversations.takeover', 'conversations.whisper', 'conversations.reassign',
                     'sla_config.read', 'sla_config.update', 'escalations.read')) AS perm_count;
