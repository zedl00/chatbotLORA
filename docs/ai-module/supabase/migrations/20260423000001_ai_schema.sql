-- Ruta: /supabase/migrations/20260423000001_ai_schema.sql
-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN 8 — MOTOR IA
--   - bot_personas: múltiples personalidades del bot por org
--   - ai_usage_log: registro de cada llamada a Claude (auditoría + costos)
--   - knowledge_chunks: fragmentos con embeddings para RAG
--   - message_classifications: intención/sentimiento por mensaje
--   - ai_rate_limits: control de abuso/costos
-- ═══════════════════════════════════════════════════════════════

-- ── TIPOS ENUM ──────────────────────────────────────────────────
CREATE TYPE ai_operation AS ENUM (
  'chat',         -- respuesta principal
  'classify',     -- clasificación de intención
  'summarize',    -- resumen de conversación
  'suggest',      -- sugerencia para agente
  'embed'         -- generación de embedding
);

CREATE TYPE intent_category AS ENUM (
  'question',     -- pregunta informativa
  'complaint',    -- queja
  'sales',        -- intención de compra
  'support',      -- soporte técnico
  'greeting',     -- saludo
  'farewell',     -- despedida
  'handoff',      -- pide humano explícitamente
  'spam',         -- mensaje no relacionado
  'other'
);

CREATE TYPE sentiment AS ENUM ('positive', 'neutral', 'negative');

CREATE TYPE urgency_level AS ENUM ('low', 'normal', 'high', 'urgent');

-- ═══════════════════════════════════════════════════════════════
-- TABLA: bot_personas
-- Personalidades configurables del bot (Soporte, Ventas, etc.)
-- Una org puede tener varias; cada canal/flujo elige cuál usar.
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE bot_personas (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                VARCHAR(100) NOT NULL,          -- "Soporte", "Ventas"
  slug                VARCHAR(50)  NOT NULL,          -- "support", "sales"
  description         TEXT,
  avatar_url          TEXT,
  -- System prompt partes compuestas (se renderizan en una plantilla)
  identity            TEXT NOT NULL,                  -- "Eres X, asistente de Y"
  objective           TEXT,                           -- "Tu objetivo es..."
  tone                VARCHAR(50) DEFAULT 'friendly', -- friendly | formal | casual | professional
  language            VARCHAR(10) DEFAULT 'es',
  restrictions        TEXT,                           -- "No puedes..."
  fallback_message    TEXT DEFAULT 'Déjame verificar eso y te respondo en unos minutos.',
  handoff_keyword     VARCHAR(50) DEFAULT '[HANDOFF]', -- palabra clave para solicitar humano
  -- Configuración del modelo
  model               VARCHAR(100) DEFAULT 'claude-sonnet-4-20250514',
  temperature         NUMERIC(3,2) DEFAULT 0.7 CHECK (temperature BETWEEN 0 AND 2),
  max_tokens          INT DEFAULT 1000,
  max_history_msgs    INT DEFAULT 20,                 -- cuántos mensajes del historial incluir
  -- RAG
  use_knowledge_base  BOOLEAN DEFAULT true,
  kb_top_k            INT DEFAULT 5,                  -- cuántos chunks recuperar
  kb_threshold        NUMERIC(4,3) DEFAULT 0.75,      -- similitud mínima
  -- Features opcionales
  enable_classification BOOLEAN DEFAULT true,
  enable_suggestions    BOOLEAN DEFAULT true,
  is_default          BOOLEAN DEFAULT false,
  active              BOOLEAN DEFAULT true,
  created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, slug)
);

CREATE INDEX idx_bot_personas_org ON bot_personas(organization_id);
CREATE INDEX idx_bot_personas_active ON bot_personas(active) WHERE active = true;
CREATE INDEX idx_bot_personas_default ON bot_personas(organization_id, is_default) WHERE is_default = true;

CREATE TRIGGER trg_bot_personas_updated_at
  BEFORE UPDATE ON bot_personas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Solo una persona default por org
CREATE UNIQUE INDEX idx_bot_personas_unique_default
  ON bot_personas(organization_id)
  WHERE is_default = true;

-- ═══════════════════════════════════════════════════════════════
-- TABLA: conversations — agregar bot_persona_id
-- (agregamos columna sin romper lo existente)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS bot_persona_id UUID REFERENCES bot_personas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_persona ON conversations(bot_persona_id);

-- ═══════════════════════════════════════════════════════════════
-- TABLA: channels — agregar default_persona_id
-- Permite asignar persona por canal (ej: widget usa "General", WA usa "Soporte")
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE channels
  ADD COLUMN IF NOT EXISTS default_persona_id UUID REFERENCES bot_personas(id) ON DELETE SET NULL;

-- ═══════════════════════════════════════════════════════════════
-- TABLA: knowledge_chunks
-- Un documento de knowledge_base se divide en chunks indexables.
-- Cada chunk tiene su propio embedding.
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE knowledge_chunks (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  document_id         UUID NOT NULL REFERENCES knowledge_base(id) ON DELETE CASCADE,
  chunk_index         INT NOT NULL,                   -- orden dentro del doc
  content             TEXT NOT NULL,
  token_count         INT,
  embedding           VECTOR(1024),                   -- 1024 dims (Voyage voyage-3)
  embedding_model     VARCHAR(100),
  metadata            JSONB DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE(document_id, chunk_index)
);

CREATE INDEX idx_kb_chunks_org ON knowledge_chunks(organization_id);
CREATE INDEX idx_kb_chunks_doc ON knowledge_chunks(document_id);
CREATE INDEX idx_kb_chunks_embedding ON knowledge_chunks
  USING hnsw (embedding vector_cosine_ops);

-- ═══════════════════════════════════════════════════════════════
-- TABLA: message_classifications
-- Enriquecimiento de un mensaje: intención, sentimiento, urgencia.
-- Se genera asincrónicamente por claude-classify.
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE message_classifications (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id          UUID NOT NULL UNIQUE REFERENCES messages(id) ON DELETE CASCADE,
  conversation_id     UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  intent              intent_category,
  sentiment           sentiment,
  urgency             urgency_level DEFAULT 'normal',
  language            VARCHAR(10),
  topics              TEXT[] DEFAULT ARRAY[]::TEXT[],
  entities            JSONB DEFAULT '{}'::jsonb,      -- nombre, email, teléfono, etc. extraídos
  confidence          NUMERIC(3,2),
  model               VARCHAR(100),
  tokens_used         INT,
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_msg_class_msg ON message_classifications(message_id);
CREATE INDEX idx_msg_class_conv ON message_classifications(conversation_id);
CREATE INDEX idx_msg_class_intent ON message_classifications(intent);
CREATE INDEX idx_msg_class_sentiment ON message_classifications(sentiment);
CREATE INDEX idx_msg_class_urgency ON message_classifications(urgency) WHERE urgency IN ('high', 'urgent');

-- ═══════════════════════════════════════════════════════════════
-- TABLA: ai_usage_log
-- Registro de cada llamada a Claude: operación, tokens, costo.
-- Fuente para dashboard de uso.
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE ai_usage_log (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id     UUID REFERENCES conversations(id) ON DELETE SET NULL,
  operation           ai_operation NOT NULL,
  model               VARCHAR(100) NOT NULL,
  input_tokens        INT NOT NULL DEFAULT 0,
  output_tokens       INT NOT NULL DEFAULT 0,
  total_tokens        INT GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
  -- Costo en USD (microdólares para precisión; 1 USD = 1,000,000)
  cost_usd_micro      BIGINT DEFAULT 0,
  latency_ms          INT,
  success             BOOLEAN DEFAULT true,
  error_message       TEXT,
  requested_by        UUID REFERENCES users(id) ON DELETE SET NULL,  -- agente o NULL si es bot
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ai_usage_org_date ON ai_usage_log(organization_id, created_at DESC);
CREATE INDEX idx_ai_usage_operation ON ai_usage_log(operation);
CREATE INDEX idx_ai_usage_conv ON ai_usage_log(conversation_id);
CREATE INDEX idx_ai_usage_success ON ai_usage_log(success) WHERE success = false;

-- ═══════════════════════════════════════════════════════════════
-- TABLA: ai_rate_limits
-- Circuit breaker por organización.
-- Si hay muchos errores consecutivos, pausa la IA automáticamente.
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE ai_rate_limits (
  organization_id     UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  consecutive_errors  INT DEFAULT 0,
  paused_until        TIMESTAMPTZ,
  pause_reason        TEXT,
  last_error_at       TIMESTAMPTZ,
  last_success_at     TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════
-- VISTA: v_ai_usage_monthly
-- Resumen mensual para dashboard
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW public.v_ai_usage_monthly AS
SELECT
  organization_id,
  date_trunc('month', created_at) AS month,
  operation,
  model,
  COUNT(*)                                    AS call_count,
  SUM(input_tokens)                           AS total_input_tokens,
  SUM(output_tokens)                          AS total_output_tokens,
  SUM(total_tokens)                           AS total_tokens,
  SUM(cost_usd_micro) / 1000000.0             AS total_cost_usd,
  AVG(latency_ms)::INT                        AS avg_latency_ms,
  COUNT(*) FILTER (WHERE success = false)     AS error_count
FROM ai_usage_log
GROUP BY organization_id, date_trunc('month', created_at), operation, model;

-- ═══════════════════════════════════════════════════════════════
-- FUNCIÓN: match_knowledge_chunks
-- Búsqueda semántica de chunks (versión del match_knowledge_base pero con chunks)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.match_knowledge_chunks(
  p_org_id      UUID,
  p_embedding   VECTOR(1024),
  p_threshold   FLOAT DEFAULT 0.75,
  p_match_count INT DEFAULT 5
)
RETURNS TABLE (
  chunk_id     UUID,
  document_id  UUID,
  document_title VARCHAR(255),
  content      TEXT,
  similarity   FLOAT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id,
    kc.document_id,
    kb.title,
    kc.content,
    1 - (kc.embedding <=> p_embedding) AS similarity
  FROM knowledge_chunks kc
  JOIN knowledge_base kb ON kb.id = kc.document_id
  WHERE kc.organization_id = p_org_id
    AND kb.active = true
    AND kc.embedding IS NOT NULL
    AND 1 - (kc.embedding <=> p_embedding) > p_threshold
  ORDER BY kc.embedding <=> p_embedding
  LIMIT p_match_count;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- FUNCIÓN: get_current_month_tokens
-- Para mostrar en el dashboard: tokens usados este mes
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_current_month_tokens(p_org_id UUID)
RETURNS TABLE (
  total_tokens    BIGINT,
  total_cost_usd  NUMERIC,
  call_count      BIGINT,
  chat_count      BIGINT,
  error_count     BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COALESCE(SUM(total_tokens), 0)::BIGINT,
    COALESCE(SUM(cost_usd_micro) / 1000000.0, 0)::NUMERIC,
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE operation = 'chat')::BIGINT,
    COUNT(*) FILTER (WHERE success = false)::BIGINT
  FROM ai_usage_log
  WHERE organization_id = p_org_id
    AND created_at >= date_trunc('month', now());
$$;

-- ═══════════════════════════════════════════════════════════════
-- FUNCIÓN: register_ai_usage
-- Insert atómico con incremento de contador de org.
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.register_ai_usage(
  p_org_id          UUID,
  p_conversation_id UUID,
  p_operation       ai_operation,
  p_model           TEXT,
  p_input_tokens    INT,
  p_output_tokens   INT,
  p_cost_usd_micro  BIGINT DEFAULT 0,
  p_latency_ms      INT DEFAULT NULL,
  p_success         BOOLEAN DEFAULT true,
  p_error_message   TEXT DEFAULT NULL,
  p_requested_by    UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_id UUID;
  v_total INT;
BEGIN
  v_total := p_input_tokens + p_output_tokens;

  INSERT INTO ai_usage_log (
    organization_id, conversation_id, operation, model,
    input_tokens, output_tokens, cost_usd_micro, latency_ms,
    success, error_message, requested_by
  )
  VALUES (
    p_org_id, p_conversation_id, p_operation, p_model,
    p_input_tokens, p_output_tokens, p_cost_usd_micro, p_latency_ms,
    p_success, p_error_message, p_requested_by
  )
  RETURNING id INTO v_id;

  -- Incrementar contador de org
  UPDATE organizations
    SET ai_tokens_used = ai_tokens_used + v_total
  WHERE id = p_org_id;

  -- Actualizar rate limits
  INSERT INTO ai_rate_limits (organization_id, last_success_at, last_error_at, consecutive_errors)
  VALUES (
    p_org_id,
    CASE WHEN p_success THEN now() ELSE NULL END,
    CASE WHEN p_success THEN NULL ELSE now() END,
    CASE WHEN p_success THEN 0 ELSE 1 END
  )
  ON CONFLICT (organization_id) DO UPDATE SET
    last_success_at    = CASE WHEN p_success THEN now() ELSE ai_rate_limits.last_success_at END,
    last_error_at      = CASE WHEN p_success THEN ai_rate_limits.last_error_at ELSE now() END,
    consecutive_errors = CASE WHEN p_success THEN 0 ELSE ai_rate_limits.consecutive_errors + 1 END,
    paused_until       = CASE
                          WHEN NOT p_success AND ai_rate_limits.consecutive_errors >= 4
                          THEN now() + interval '10 minutes'
                          ELSE ai_rate_limits.paused_until
                        END,
    pause_reason       = CASE
                          WHEN NOT p_success AND ai_rate_limits.consecutive_errors >= 4
                          THEN 'Pausado automáticamente tras 5 errores consecutivos'
                          ELSE ai_rate_limits.pause_reason
                        END,
    updated_at         = now();

  RETURN v_id;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE bot_personas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_log            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_rate_limits          ENABLE ROW LEVEL SECURITY;

-- bot_personas
CREATE POLICY "personas_select_same_org" ON bot_personas
  FOR SELECT USING (organization_id = public.current_user_org_id());

CREATE POLICY "personas_manage_with_permission" ON bot_personas
  FOR ALL USING (
    organization_id = public.current_user_org_id()
    AND public.current_user_has('ai.configure')
  )
  WITH CHECK (organization_id = public.current_user_org_id());

-- knowledge_chunks
CREATE POLICY "chunks_select_same_org" ON knowledge_chunks
  FOR SELECT USING (organization_id = public.current_user_org_id());

-- message_classifications
CREATE POLICY "classifications_select_same_org" ON message_classifications
  FOR SELECT USING (organization_id = public.current_user_org_id());

-- ai_usage_log
CREATE POLICY "ai_usage_select_with_permission" ON ai_usage_log
  FOR SELECT USING (
    organization_id = public.current_user_org_id()
    AND public.current_user_has('ai.view_costs')
  );

-- ai_rate_limits
CREATE POLICY "rate_limits_select_with_permission" ON ai_rate_limits
  FOR SELECT USING (
    organization_id = public.current_user_org_id()
    AND public.current_user_has('ai.configure')
  );

-- Publicar a realtime
ALTER PUBLICATION supabase_realtime ADD TABLE message_classifications;

-- ═══════════════════════════════════════════════════════════════
-- SEED: una persona "General" por defecto para la org demo
-- ═══════════════════════════════════════════════════════════════
INSERT INTO bot_personas (
  organization_id, name, slug, description,
  identity, objective, tone, language,
  restrictions, is_default, active
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Asistente General',
  'general',
  'Asistente virtual por defecto para atención general',
  'Eres un asistente virtual amigable y profesional de la empresa. Hablas español de forma natural.',
  'Tu objetivo es ayudar a los clientes con sus consultas de forma rápida y precisa. Si no sabes algo o la consulta requiere intervención humana, usa la palabra clave [HANDOFF] al inicio de tu respuesta.',
  'friendly',
  'es',
  'No inventes información. No des consejos médicos, legales o financieros específicos. No prometas cosas que no puedas cumplir.',
  true,
  true
) ON CONFLICT (organization_id, slug) DO NOTHING;

COMMENT ON TABLE bot_personas IS 'Personalidades configurables del bot (Soporte, Ventas, General).';
COMMENT ON TABLE knowledge_chunks IS 'Fragmentos de knowledge_base con embeddings para RAG.';
COMMENT ON TABLE message_classifications IS 'Enriquecimiento async: intención, sentimiento, urgencia.';
COMMENT ON TABLE ai_usage_log IS 'Registro atómico de cada llamada a Claude. Fuente del dashboard de costos.';
