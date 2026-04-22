-- Ruta: /supabase/migrations/20260421000003_functions_triggers.sql
-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN 3 — FUNCIONES Y TRIGGERS
-- - Actualización automática de updated_at
-- - Sincronización conversations.last_message_*  desde messages
-- - Registro de first_response_at
-- - Función de búsqueda semántica RAG
-- - Función de asignación automática (round-robin)
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- FUNCIÓN: set_updated_at
-- Trigger genérico para mantener la columna updated_at al día.
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Aplicar a todas las tablas con updated_at
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'updated_at'
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at
         BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      t, t
    );
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- FUNCIÓN: on_message_insert
-- Al insertar un mensaje, actualiza la conversación:
--   - last_message_at / last_message_preview
--   - first_response_at (si aplica)
--   - unread_count (si es del contacto)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.on_message_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  conv RECORD;
BEGIN
  SELECT * INTO conv FROM conversations WHERE id = NEW.conversation_id;

  UPDATE conversations
    SET
      last_message_at = NEW.created_at,
      last_message_preview = LEFT(COALESCE(NEW.content, '[media]'), 500),
      -- primera respuesta del agente/bot (solo si aún no estaba)
      first_response_at = CASE
        WHEN conv.first_response_at IS NULL
          AND NEW.sender_type IN ('agent', 'bot')
          THEN NEW.created_at
        ELSE conv.first_response_at
      END,
      -- incrementar no leídos si el mensaje viene del contacto
      unread_count = CASE
        WHEN NEW.sender_type = 'contact' THEN conv.unread_count + 1
        ELSE conv.unread_count
      END,
      -- incrementar tokens IA si aplica
      ai_tokens_used = conv.ai_tokens_used + COALESCE(NEW.ai_tokens_used, 0),
      updated_at = now()
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_messages_after_insert
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.on_message_insert();

-- ═══════════════════════════════════════════════════════════════
-- FUNCIÓN: on_conversation_assigned
-- Al asignar agent_id (de NULL a un valor), marca assigned_at + handoff_at.
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.on_conversation_assigned()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.agent_id IS NULL AND NEW.agent_id IS NOT NULL THEN
    NEW.assigned_at = now();
    -- Handoff: si venía con IA activa, marcamos el paso a humano
    IF NEW.ai_active = true THEN
      NEW.handoff_at = now();
      NEW.ai_active = false;
    END IF;
  END IF;

  -- Al resolver
  IF OLD.status != 'resolved' AND NEW.status = 'resolved' THEN
    NEW.resolved_at = COALESCE(NEW.resolved_at, now());
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_conversations_assignment
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.on_conversation_assigned();

-- ═══════════════════════════════════════════════════════════════
-- FUNCIÓN: handle_new_auth_user
-- Cuando se crea un auth.users, se espera que la app inserte luego en public.users.
-- Este trigger solo registra un audit_log.
-- ═══════════════════════════════════════════════════════════════
-- (Dejamos comentado porque la app controla el insert de public.users
--  con la organization_id y rol correctos. Descomentar si se quiere auto-provisión.)

-- ═══════════════════════════════════════════════════════════════
-- FUNCIÓN: match_knowledge_base
-- Búsqueda semántica RAG por similitud coseno.
-- Usar desde Edge Function al construir el prompt de Claude.
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.match_knowledge_base(
  p_org_id      UUID,
  p_embedding   VECTOR(1536),
  p_threshold   FLOAT DEFAULT 0.75,
  p_match_count INT DEFAULT 5
)
RETURNS TABLE (
  id         UUID,
  title      VARCHAR(255),
  content    TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kb.id,
    kb.title,
    kb.content,
    1 - (kb.embedding <=> p_embedding) AS similarity
  FROM knowledge_base kb
  WHERE kb.organization_id = p_org_id
    AND kb.active = true
    AND kb.embedding IS NOT NULL
    AND 1 - (kb.embedding <=> p_embedding) > p_threshold
  ORDER BY kb.embedding <=> p_embedding
  LIMIT p_match_count;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- FUNCIÓN: assign_next_agent
-- Asignación round-robin: devuelve el agent_id del agente online
-- con menos conversaciones abiertas en la org.
-- Retorna NULL si no hay agentes disponibles.
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.assign_next_agent(
  p_org_id   UUID,
  p_team_id  UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_agent_id UUID;
BEGIN
  SELECT a.id INTO v_agent_id
  FROM agents a
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS open_count
    FROM conversations c
    WHERE c.agent_id = a.id
      AND c.status IN ('open', 'pending')
  ) c ON TRUE
  WHERE a.organization_id = p_org_id
    AND a.status = 'online'
    AND a.auto_assign = true
    AND (p_team_id IS NULL OR a.team_id = p_team_id)
    AND COALESCE(c.open_count, 0) < a.max_concurrent_chats
  ORDER BY COALESCE(c.open_count, 0) ASC, a.status_changed_at DESC
  LIMIT 1;

  RETURN v_agent_id;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- FUNCIÓN: increment_org_tokens
-- Suma atómica al contador mensual de tokens de una organización.
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.increment_org_tokens(
  p_org_id  UUID,
  p_tokens  INT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE organizations
    SET ai_tokens_used = ai_tokens_used + p_tokens
  WHERE id = p_org_id;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- VISTA: v_inbox — bandeja unificada enriquecida
-- Simplifica las consultas del panel admin.
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW public.v_inbox AS
SELECT
  c.id                      AS conversation_id,
  c.organization_id,
  c.status,
  c.channel_type,
  c.priority,
  c.unread_count,
  c.last_message_at,
  c.last_message_preview,
  c.ai_active,
  c.tags                    AS conversation_tags,
  ct.id                     AS contact_id,
  ct.full_name              AS contact_name,
  ct.avatar_url             AS contact_avatar,
  ct.phone                  AS contact_phone,
  ct.email                  AS contact_email,
  a.id                      AS agent_id,
  u.full_name               AS agent_name,
  u.avatar_url              AS agent_avatar,
  c.sla_due_at,
  c.sla_breached,
  c.created_at,
  c.updated_at
FROM conversations c
JOIN contacts ct ON ct.id = c.contact_id
LEFT JOIN agents a ON a.id = c.agent_id
LEFT JOIN users  u ON u.id = a.user_id;

COMMENT ON VIEW public.v_inbox IS 'Vista de bandeja: conversations + contact + agent ya unidos.';

-- ═══════════════════════════════════════════════════════════════
-- PUBLICACIÓN REALTIME
-- Habilita suscripciones en vivo a las tablas críticas del inbox.
-- ═══════════════════════════════════════════════════════════════
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE agents;
