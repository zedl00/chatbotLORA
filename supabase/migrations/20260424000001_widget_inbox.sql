-- Ruta: /supabase/migrations/20260424000001_widget_inbox.sql
-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN 9 — WIDGET WEB + INBOX FUNCIONAL
-- - widget_configs: configuración visual por canal web_widget
-- - widget_sessions: sesiones activas (cookie-based)
-- - Realtime publicado para inbox
-- - Funciones auxiliares para asignación y stats del inbox
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- TABLA: widget_configs
-- Personalización visual del widget embebible.
-- Un widget_config por canal web_widget.
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE widget_configs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id          UUID NOT NULL UNIQUE REFERENCES channels(id) ON DELETE CASCADE,
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Identidad visual
  brand_name          VARCHAR(100) DEFAULT 'ChatBot',
  logo_url            TEXT,
  primary_color       VARCHAR(7) DEFAULT '#2b7bff',
  accent_color        VARCHAR(7) DEFAULT '#155df5',
  position            VARCHAR(20) DEFAULT 'bottom-right',  -- bottom-right | bottom-left
  launcher_icon       VARCHAR(10) DEFAULT '💬',

  -- Copy
  welcome_title       VARCHAR(200) DEFAULT '¡Hola! 👋',
  welcome_subtitle    TEXT DEFAULT '¿En qué podemos ayudarte hoy?',
  input_placeholder   VARCHAR(200) DEFAULT 'Escribe un mensaje...',
  offline_message     TEXT DEFAULT 'Dejanos tu mensaje y te responderemos pronto.',

  -- Pre-chat form: qué datos pedir al usuario antes de chatear
  require_name        BOOLEAN DEFAULT false,
  require_email       BOOLEAN DEFAULT false,
  require_phone       BOOLEAN DEFAULT false,
  pre_chat_message    TEXT DEFAULT 'Cuéntanos un poco sobre ti para atenderte mejor:',

  -- Comportamiento
  auto_open           BOOLEAN DEFAULT false,
  auto_open_delay_ms  INT DEFAULT 5000,
  show_powered_by     BOOLEAN DEFAULT true,
  allowed_origins     TEXT[] DEFAULT ARRAY['*']::TEXT[],  -- dominios donde puede embeberse
  active              BOOLEAN DEFAULT true,

  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_widget_configs_channel ON widget_configs(channel_id);
CREATE INDEX idx_widget_configs_org ON widget_configs(organization_id);

CREATE TRIGGER trg_widget_configs_updated_at
  BEFORE UPDATE ON widget_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- TABLA: widget_sessions
-- Tracking de visitantes del widget via cookie/localStorage.
-- Mapea un visitor_id anónimo a un contact_id.
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE widget_sessions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id          UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  visitor_id          VARCHAR(100) NOT NULL,        -- UUID generado en el cliente
  contact_id          UUID REFERENCES contacts(id) ON DELETE SET NULL,
  conversation_id     UUID REFERENCES conversations(id) ON DELETE SET NULL,

  -- Metadata del visitante
  visitor_name        VARCHAR(200),
  visitor_email       VARCHAR(255),
  visitor_phone       VARCHAR(50),
  visitor_metadata    JSONB DEFAULT '{}'::jsonb,    -- página actual, referrer, UA, etc.

  first_seen_at       TIMESTAMPTZ DEFAULT now(),
  last_seen_at        TIMESTAMPTZ DEFAULT now(),
  expires_at          TIMESTAMPTZ DEFAULT (now() + interval '30 days'),

  UNIQUE(channel_id, visitor_id)
);

CREATE INDEX idx_widget_sessions_visitor ON widget_sessions(channel_id, visitor_id);
CREATE INDEX idx_widget_sessions_contact ON widget_sessions(contact_id);
CREATE INDEX idx_widget_sessions_conv ON widget_sessions(conversation_id);
CREATE INDEX idx_widget_sessions_expires ON widget_sessions(expires_at);

-- ═══════════════════════════════════════════════════════════════
-- Campos adicionales para conversations (para el inbox)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS unread_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_message_preview TEXT,
  ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ DEFAULT now();

-- ═══════════════════════════════════════════════════════════════
-- TRIGGER: al insertar mensaje, actualizar conversations
-- (preview, last_message_at, unread_count si no es del agente)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.update_conversation_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE conversations
  SET
    last_message_preview = LEFT(NEW.content, 200),
    last_message_at = NEW.created_at,
    unread_count = CASE
      WHEN NEW.sender_type IN ('contact', 'bot')
      THEN unread_count + 1
      ELSE unread_count
    END,
    updated_at = now()
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_conversation_on_message ON messages;
CREATE TRIGGER trg_update_conversation_on_message
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION public.update_conversation_on_message();

-- ═══════════════════════════════════════════════════════════════
-- FUNCIÓN: mark_conversation_read
-- Marcar conversación como leída (el agente entró a verla)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.mark_conversation_read(p_conversation_id UUID)
RETURNS VOID
LANGUAGE sql
AS $$
  UPDATE conversations
  SET unread_count = 0
  WHERE id = p_conversation_id;
$$;

-- ═══════════════════════════════════════════════════════════════
-- FUNCIÓN: assign_conversation
-- Asigna una conversación a un agente (toma propiedad).
-- Verifica permisos en el RLS, pero aquí está la lógica atómica.
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.assign_conversation(
  p_conversation_id UUID,
  p_agent_id        UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE conversations
  SET agent_id = p_agent_id,
      ai_active = false,   -- al tomar, se desactiva IA
      updated_at = now()
  WHERE id = p_conversation_id;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- FUNCIÓN: toggle_conversation_ai
-- Activar/desactivar IA por conversación
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.toggle_conversation_ai(
  p_conversation_id UUID,
  p_active          BOOLEAN
)
RETURNS VOID
LANGUAGE sql
AS $$
  UPDATE conversations
  SET ai_active = p_active,
      updated_at = now()
  WHERE id = p_conversation_id;
$$;

-- ═══════════════════════════════════════════════════════════════
-- VIEW: v_inbox_conversations
-- Vista optimizada para el inbox: conversations + contact + agent
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW public.v_inbox_conversations AS
SELECT
  c.id,
  c.organization_id,
  c.channel_id,
  c.channel_type,
  c.status,
  c.agent_id,
  c.bot_persona_id,
  c.ai_active,
  c.subject,
  c.tags,
  c.priority,
  c.unread_count,
  c.last_message_preview,
  c.last_message_at,
  c.handoff_at,
  c.csat_score,
  c.created_at,
  c.updated_at,
  -- Contact data
  ct.id AS contact_id,
  ct.full_name AS contact_name,
  ct.email AS contact_email,
  ct.phone AS contact_phone,
  ct.avatar_url AS contact_avatar,
  ct.tags AS contact_tags,
  -- Agent data
  a.id AS assigned_agent_id,
  u.full_name AS agent_name,
  u.email AS agent_email,
  -- Channel name
  ch.name AS channel_name,
  -- Classification del último mensaje (mc.urgency para ordenar)
  (
    SELECT mc.urgency
    FROM message_classifications mc
    JOIN messages m ON m.id = mc.message_id
    WHERE m.conversation_id = c.id
      AND m.sender_type = 'contact'
    ORDER BY m.created_at DESC
    LIMIT 1
  ) AS last_urgency,
  (
    SELECT mc.sentiment
    FROM message_classifications mc
    JOIN messages m ON m.id = mc.message_id
    WHERE m.conversation_id = c.id
      AND m.sender_type = 'contact'
    ORDER BY m.created_at DESC
    LIMIT 1
  ) AS last_sentiment
FROM conversations c
LEFT JOIN contacts ct ON ct.id = c.contact_id
LEFT JOIN agents a    ON a.id = c.agent_id
LEFT JOIN users u     ON u.id = a.user_id
LEFT JOIN channels ch ON ch.id = c.channel_id;

GRANT SELECT ON public.v_inbox_conversations TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE widget_configs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE widget_sessions ENABLE ROW LEVEL SECURITY;

-- widget_configs: leer requiere estar en la org; editar requiere channels.update
CREATE POLICY "widget_configs_select_same_org" ON widget_configs
  FOR SELECT USING (organization_id = public.current_user_org_id());

CREATE POLICY "widget_configs_manage_with_permission" ON widget_configs
  FOR ALL USING (
    organization_id = public.current_user_org_id()
    AND public.current_user_has('channels.update')
  )
  WITH CHECK (organization_id = public.current_user_org_id());

-- widget_sessions: solo lectura con permisos de agente, inserción via service role
CREATE POLICY "widget_sessions_select_same_org" ON widget_sessions
  FOR SELECT USING (
    organization_id = public.current_user_org_id()
    AND public.current_user_has('contacts.read')
  );

-- ═══════════════════════════════════════════════════════════════
-- REALTIME: publicar tablas necesarias para el inbox
-- (algunas ya estaban publicadas desde Sprint 1)
-- ═══════════════════════════════════════════════════════════════
-- Comprobar y publicar solo si no está publicada
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- SEED: widget_config para el canal existente
-- ═══════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_channel RECORD;
BEGIN
  FOR v_channel IN
    SELECT id, organization_id
    FROM channels
    WHERE type = 'web_widget'
  LOOP
    INSERT INTO widget_configs (
      channel_id, organization_id,
      brand_name, welcome_title, welcome_subtitle
    )
    VALUES (
      v_channel.id, v_channel.organization_id,
      'Asistente', '¡Hola! 👋', '¿En qué podemos ayudarte hoy?'
    )
    ON CONFLICT (channel_id) DO NOTHING;
  END LOOP;
END $$;

COMMENT ON TABLE widget_configs IS 'Personalización visual del widget web por canal.';
COMMENT ON TABLE widget_sessions IS 'Tracking de visitantes del widget via cookie/localStorage.';
COMMENT ON VIEW v_inbox_conversations IS 'Vista agregada para el inbox con contact, agent, urgencia y sentimiento.';
