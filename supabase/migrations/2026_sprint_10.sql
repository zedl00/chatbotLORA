-- ═══════════════════════════════════════════════════════════════
-- Sprint 10 · Agent Analytics
--
-- Contenido:
--   1. Permisos: analytics.read
--   2. Vista v_conversations_analytics (base para queries agregadas)
--   3. Vista v_agent_metrics (métricas por agente)
--   4. Función get_heatmap_data (día × hora)
--   5. Seed: 50 conversaciones fake para demo (marcadas con metadata.seed=true)
--
-- Valores de estado válidos: 'open', 'pending', 'resolved', 'abandoned'
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. Permisos
-- ─────────────────────────────────────────────────────────────
INSERT INTO permissions (key, resource, action, description, scopeable, category, is_dangerous, sort_order)
VALUES
  ('analytics.read', 'analytics', 'read', 'Ver dashboard de métricas y analytics', false, 'reports', false, 500),
  ('analytics.export', 'analytics', 'export', 'Exportar reportes a CSV', false, 'reports', false, 501)
ON CONFLICT (key) DO NOTHING;

DO $$
DECLARE
  v_supervisor_role UUID;
  v_admin_role UUID;
  v_perm_id UUID;
  v_perm_key TEXT;
  v_perms TEXT[] := ARRAY['analytics.read', 'analytics.export'];
BEGIN
  SELECT id INTO v_supervisor_role FROM roles WHERE is_system = true AND key = 'supervisor' LIMIT 1;
  SELECT id INTO v_admin_role      FROM roles WHERE is_system = true AND key = 'admin'      LIMIT 1;

  IF v_supervisor_role IS NOT NULL THEN
    FOREACH v_perm_key IN ARRAY v_perms LOOP
      SELECT id INTO v_perm_id FROM permissions WHERE key = v_perm_key;
      IF v_perm_id IS NOT NULL THEN
        INSERT INTO role_permissions (role_id, permission_id, scope)
        VALUES (v_supervisor_role, v_perm_id, 'team') ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  IF v_admin_role IS NOT NULL THEN
    FOREACH v_perm_key IN ARRAY v_perms LOOP
      SELECT id INTO v_perm_id FROM permissions WHERE key = v_perm_key;
      IF v_perm_id IS NOT NULL THEN
        INSERT INTO role_permissions (role_id, permission_id, scope)
        VALUES (v_admin_role, v_perm_id, 'all') ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────
-- 2. Vista: v_conversations_analytics (base para queries)
-- Enriquece conversations con datos de agent/user/channel
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_conversations_analytics AS
SELECT
  c.id,
  c.organization_id,
  c.status,
  c.channel_type,
  c.channel_id,
  c.priority,
  c.team_id,
  c.tags,
  c.agent_id,
  a.user_id AS agent_user_id,
  u.full_name AS agent_name,
  u.email AS agent_email,
  c.contact_id,
  c.csat_score,
  c.ai_tokens_used,
  c.created_at,
  c.handoff_at,
  c.assigned_at,
  c.first_response_at,
  c.resolved_at,
  -- Métricas calculadas
  EXTRACT(EPOCH FROM (c.first_response_at - c.handoff_at))::INTEGER AS frt_seconds,
  EXTRACT(EPOCH FROM (c.resolved_at - c.created_at))::INTEGER AS resolution_seconds,
  -- Flag útil
  (c.handoff_at IS NOT NULL) AS was_handoffed,
  (c.agent_id IS NOT NULL) AS has_human_agent
FROM conversations c
LEFT JOIN agents a ON a.id = c.agent_id
LEFT JOIN users u ON u.id = a.user_id;

GRANT SELECT ON v_conversations_analytics TO authenticated;


-- ─────────────────────────────────────────────────────────────
-- 3. Vista: v_agent_metrics (por agente, para leaderboard)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_agent_metrics AS
SELECT
  a.id AS agent_id,
  a.organization_id,
  a.user_id,
  u.full_name AS agent_name,
  u.email AS agent_email,
  a.team_id,
  -- Totales (histórico)
  COUNT(c.id) AS total_conversations,
  COUNT(c.id) FILTER (WHERE c.status = 'resolved') AS resolved_count,
  COUNT(c.id) FILTER (WHERE c.status = 'abandoned') AS abandoned_count,
  COUNT(c.id) FILTER (WHERE c.status = 'open') AS open_count,
  -- Calidad
  ROUND(AVG(c.csat_score) FILTER (WHERE c.csat_score IS NOT NULL)::numeric, 2) AS avg_csat,
  COUNT(c.csat_score) FILTER (WHERE c.csat_score IS NOT NULL) AS csat_ratings_count,
  -- Tiempos
  ROUND(AVG(EXTRACT(EPOCH FROM (c.first_response_at - c.handoff_at)))::numeric, 0) AS avg_frt_seconds,
  ROUND(AVG(EXTRACT(EPOCH FROM (c.resolved_at - c.created_at)))::numeric, 0) AS avg_resolution_seconds,
  -- Actividad
  MAX(c.last_message_at) AS last_activity_at
FROM agents a
JOIN users u ON u.id = a.user_id
LEFT JOIN conversations c ON c.agent_id = a.id
GROUP BY a.id, a.organization_id, a.user_id, u.full_name, u.email, a.team_id;

GRANT SELECT ON v_agent_metrics TO authenticated;


-- ─────────────────────────────────────────────────────────────
-- 4. RPC: get_heatmap_data — día de la semana × hora
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_heatmap_data(
  p_organization_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT (NOW() - INTERVAL '30 days'),
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  day_of_week INTEGER,
  hour_of_day INTEGER,
  conversation_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    EXTRACT(DOW FROM created_at)::INTEGER AS day_of_week,
    EXTRACT(HOUR FROM created_at)::INTEGER AS hour_of_day,
    COUNT(*)::BIGINT AS conversation_count
  FROM conversations
  WHERE organization_id = p_organization_id
    AND created_at >= p_start_date
    AND created_at <= p_end_date
  GROUP BY day_of_week, hour_of_day
  ORDER BY day_of_week, hour_of_day;
$$;

GRANT EXECUTE ON FUNCTION get_heatmap_data(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;


-- ─────────────────────────────────────────────────────────────
-- 5. SEED: 50 conversaciones fake para demo
-- Marcadas con metadata.seed = true para poder borrarlas fácil:
--   DELETE FROM conversations WHERE metadata->>'seed' = 'true';
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_org_id UUID;
  v_channel_id UUID;
  v_contact_id UUID;
  v_agent_record RECORD;
  v_i INTEGER;
  v_created_at TIMESTAMPTZ;
  v_handoff_offset INTEGER;
  v_frt_seconds INTEGER;
  v_status TEXT;
  v_resolved_at TIMESTAMPTZ;
  v_csat INTEGER;
  v_channels TEXT[] := ARRAY['web_widget', 'whatsapp', 'telegram', 'instagram', 'messenger', 'email'];
  v_channel TEXT;
  v_priorities INTEGER[] := ARRAY[0, 1, 2, 3];
  v_priority INTEGER;
  v_conversation_id UUID;
  v_handoff_at TIMESTAMPTZ;
  v_first_response_at TIMESTAMPTZ;
BEGIN
  -- Usar la primera org disponible
  SELECT id INTO v_org_id FROM organizations ORDER BY created_at LIMIT 1;
  IF v_org_id IS NULL THEN
    RAISE NOTICE 'No hay organizaciones, seed abortado';
    RETURN;
  END IF;

  -- Crear un canal web_widget de demo si no hay
  SELECT id INTO v_channel_id FROM channels
    WHERE organization_id = v_org_id AND type = 'web_widget'
    LIMIT 1;

  IF v_channel_id IS NULL THEN
    INSERT INTO channels (organization_id, type, name, config)
    VALUES (v_org_id, 'web_widget', 'Web Widget Demo', '{}'::jsonb)
    RETURNING id INTO v_channel_id;
  END IF;

  -- Crear un contacto de demo si no hay ninguno
  SELECT id INTO v_contact_id FROM contacts
    WHERE organization_id = v_org_id LIMIT 1;

  IF v_contact_id IS NULL THEN
    INSERT INTO contacts (organization_id, full_name, email, metadata)
    VALUES (v_org_id, 'Contacto Demo', 'demo@ejemplo.com', '{"seed": true}'::jsonb)
    RETURNING id INTO v_contact_id;
  END IF;

  -- Generar 50 conversaciones distribuidas en los últimos 30 días
  FOR v_i IN 1..50 LOOP
    -- Random created_at en los últimos 30 días (con horario realista 8am-10pm)
    v_created_at := NOW()
      - (random() * INTERVAL '30 days')
      - (floor(random() * 14)::INTEGER - 7) * INTERVAL '1 hour';

    -- 60% resolved, 15% open, 15% pending, 10% abandoned
    CASE
      WHEN v_i <= 30 THEN v_status := 'resolved';
      WHEN v_i <= 37 THEN v_status := 'open';
      WHEN v_i <= 45 THEN v_status := 'pending';
      ELSE v_status := 'abandoned';
    END CASE;

    -- Canal random
    v_channel := v_channels[1 + floor(random() * array_length(v_channels, 1))::INTEGER];

    -- Prioridad random
    v_priority := v_priorities[1 + floor(random() * array_length(v_priorities, 1))::INTEGER];

    -- Handoff 2-10 min después de creación
    v_handoff_offset := 120 + floor(random() * 480)::INTEGER;
    v_handoff_at := v_created_at + (v_handoff_offset * INTERVAL '1 second');

    -- FRT: normalmente 30s - 8min (vario para que el CSAT tenga correlación)
    v_frt_seconds := 30 + floor(random() * 480)::INTEGER;
    v_first_response_at := v_handoff_at + (v_frt_seconds * INTERVAL '1 second');

    -- Resolved_at y csat solo si es resolved
    v_resolved_at := NULL;
    v_csat := NULL;
    IF v_status = 'resolved' THEN
      v_resolved_at := v_first_response_at + (floor(random() * 1800)::INTEGER * INTERVAL '1 second');
      -- CSAT: 70% son 4-5, 20% son 3, 10% son 1-2
      IF random() < 0.7 THEN
        v_csat := 4 + floor(random() * 2)::INTEGER;
      ELSIF random() < 0.9 THEN
        v_csat := 3;
      ELSE
        v_csat := 1 + floor(random() * 2)::INTEGER;
      END IF;
    END IF;

    -- Pick random agent con probabilidades distribuidas
    -- El primer agente recibe el 50% de las convs (para que haya un "top")
    IF random() < 0.5 THEN
      SELECT * INTO v_agent_record FROM agents
        WHERE organization_id = v_org_id
        ORDER BY created_at LIMIT 1;
    ELSE
      SELECT * INTO v_agent_record FROM agents
        WHERE organization_id = v_org_id
        ORDER BY random() LIMIT 1;
    END IF;

    -- Insert la conversación
    INSERT INTO conversations (
      organization_id, contact_id, channel_id, channel_type,
      agent_id, status, ai_active, priority,
      tags, ai_tokens_used,
      created_at, handoff_at, assigned_at, first_response_at, resolved_at,
      csat_score,
      last_message_at, last_message_preview,
      metadata
    ) VALUES (
      v_org_id, v_contact_id, v_channel_id, v_channel::channel_type,
      v_agent_record.id,
      v_status::conversation_status,
      false, v_priority,
      ARRAY['seed', 'demo'],
      floor(random() * 500)::INTEGER,
      v_created_at, v_handoff_at, v_handoff_at, v_first_response_at, v_resolved_at,
      v_csat,
      COALESCE(v_resolved_at, v_first_response_at, v_created_at),
      'Conversación de demo #' || v_i,
      jsonb_build_object('seed', true, 'demo_index', v_i)
    )
    RETURNING id INTO v_conversation_id;

    -- Insertar 3-8 mensajes por conversación (con timing realista)
    -- Mensaje inicial del contacto
    INSERT INTO messages (conversation_id, organization_id, sender_type, content, content_type, status, metadata, created_at)
    VALUES (v_conversation_id, v_org_id, 'contact', 'Hola, necesito ayuda con mi pedido.', 'text', 'delivered',
            jsonb_build_object('seed', true), v_created_at);

    -- Respuesta del bot
    INSERT INTO messages (conversation_id, organization_id, sender_type, content, content_type, status, metadata, created_at)
    VALUES (v_conversation_id, v_org_id, 'bot', '¡Hola! Claro, con gusto. Déjame transferirte con un agente.', 'text', 'delivered',
            jsonb_build_object('seed', true), v_created_at + INTERVAL '30 seconds');

    -- Respuesta del agente (si hubo first_response)
    IF v_first_response_at IS NOT NULL THEN
      INSERT INTO messages (conversation_id, organization_id, sender_type, sender_id, content, content_type, status, metadata, created_at)
      VALUES (v_conversation_id, v_org_id, 'agent', v_agent_record.user_id,
              'Hola, ¿en qué puedo ayudarte?', 'text', 'delivered',
              jsonb_build_object('seed', true), v_first_response_at);
    END IF;
  END LOOP;

  RAISE NOTICE 'Seed completado: 50 conversaciones creadas';
END $$;


COMMIT;


-- ─────────────────────────────────────────────────────────────
-- Verificaciones
-- ─────────────────────────────────────────────────────────────
SELECT 'permisos' AS check_, COUNT(*) AS count_
FROM permissions WHERE resource = 'analytics';

SELECT 'vista_analytics' AS check_, EXISTS (
  SELECT 1 FROM information_schema.views WHERE table_name = 'v_conversations_analytics'
) AS exists_;

SELECT 'vista_agent_metrics' AS check_, EXISTS (
  SELECT 1 FROM information_schema.views WHERE table_name = 'v_agent_metrics'
) AS exists_;

SELECT 'rpc_heatmap' AS check_, EXISTS (
  SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_heatmap_data'
) AS exists_;

SELECT 'seed_conversations' AS check_, COUNT(*) AS count_
FROM conversations WHERE metadata->>'seed' = 'true';

SELECT 'seed_por_estado' AS check_, status::text, COUNT(*) AS count_
FROM conversations WHERE metadata->>'seed' = 'true'
GROUP BY status ORDER BY status;
