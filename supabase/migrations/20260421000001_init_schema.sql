-- Ruta: /supabase/migrations/20260421000001_init_schema.sql
-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN 1 — SCHEMA INICIAL
-- Crea extensiones, tipos enum, tablas, índices y FKs.
-- NO incluye RLS (migración 2) ni triggers/funciones (migración 3).
-- ═══════════════════════════════════════════════════════════════

-- ── EXTENSIONES ─────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ── TIPOS ENUM ──────────────────────────────────────────────────
CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'supervisor', 'agent');
CREATE TYPE agent_status AS ENUM ('online', 'busy', 'away', 'offline');
CREATE TYPE conversation_status AS ENUM ('open', 'pending', 'resolved', 'abandoned');
CREATE TYPE channel_type AS ENUM ('whatsapp', 'instagram', 'messenger', 'telegram', 'web_widget', 'sms', 'email');
CREATE TYPE sender_type AS ENUM ('contact', 'agent', 'bot', 'system');
CREATE TYPE content_type AS ENUM ('text', 'image', 'audio', 'video', 'document', 'location', 'sticker', 'template');
CREATE TYPE message_status AS ENUM ('pending', 'sent', 'delivered', 'read', 'failed');
CREATE TYPE assignment_strategy AS ENUM ('round_robin', 'load_balanced', 'skill_based', 'manual', 'unassigned');

-- ═══════════════════════════════════════════════════════════════
-- TABLA: organizations — raíz multi-tenant
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE organizations (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              VARCHAR(255) NOT NULL,
  slug              VARCHAR(100) UNIQUE NOT NULL,
  logo_url          TEXT,
  timezone          VARCHAR(50) DEFAULT 'America/Santo_Domingo',
  locale            VARCHAR(10) DEFAULT 'es',
  plan              VARCHAR(30) DEFAULT 'starter',
  ai_tokens_limit   BIGINT DEFAULT 1000000,
  ai_tokens_used    BIGINT DEFAULT 0,
  settings          JSONB DEFAULT '{}'::jsonb,
  active            BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_active ON organizations(active);

-- ═══════════════════════════════════════════════════════════════
-- TABLA: users — internos del panel
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE users (
  id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email             VARCHAR(255) NOT NULL,
  full_name         VARCHAR(255),
  avatar_url        TEXT,
  phone             VARCHAR(30),
  role              user_role NOT NULL DEFAULT 'agent',
  active            BOOLEAN DEFAULT true,
  last_seen_at      TIMESTAMPTZ,
  preferences       JSONB DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_users_org ON users(organization_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(active) WHERE active = true;

-- ═══════════════════════════════════════════════════════════════
-- TABLA: teams
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE teams (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name              VARCHAR(150) NOT NULL,
  description       TEXT,
  supervisor_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  color             VARCHAR(10) DEFAULT '#2b7bff',
  active            BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_teams_org ON teams(organization_id);
CREATE INDEX idx_teams_supervisor ON teams(supervisor_id);

-- ═══════════════════════════════════════════════════════════════
-- TABLA: agents — perfil extendido cuando el usuario atiende
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE agents (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  organization_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id                 UUID REFERENCES teams(id) ON DELETE SET NULL,
  status                  agent_status DEFAULT 'offline',
  status_message          VARCHAR(255),
  max_concurrent_chats    INT DEFAULT 5 CHECK (max_concurrent_chats > 0),
  auto_assign             BOOLEAN DEFAULT true,
  skills                  TEXT[] DEFAULT ARRAY[]::TEXT[],
  working_hours           JSONB DEFAULT '{}'::jsonb,
  sla_tier                VARCHAR(20) DEFAULT 'standard',
  status_changed_at       TIMESTAMPTZ DEFAULT now(),
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agents_user ON agents(user_id);
CREATE INDEX idx_agents_org ON agents(organization_id);
CREATE INDEX idx_agents_team ON agents(team_id);
CREATE INDEX idx_agents_status ON agents(status) WHERE status != 'offline';

-- ═══════════════════════════════════════════════════════════════
-- TABLA: contacts — clientes finales
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE contacts (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_name           VARCHAR(255),
  email               VARCHAR(255),
  phone               VARCHAR(30),
  avatar_url          TEXT,
  locale              VARCHAR(10),
  timezone            VARCHAR(50),
  channel_identities  JSONB DEFAULT '{}'::jsonb,
  tags                TEXT[] DEFAULT ARRAY[]::TEXT[],
  custom_fields       JSONB DEFAULT '{}'::jsonb,
  notes               TEXT,
  first_seen_at       TIMESTAMPTZ DEFAULT now(),
  last_seen_at        TIMESTAMPTZ DEFAULT now(),
  blocked             BOOLEAN DEFAULT false,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_contacts_org ON contacts(organization_id);
CREATE INDEX idx_contacts_email ON contacts(email) WHERE email IS NOT NULL;
CREATE INDEX idx_contacts_phone ON contacts(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_contacts_channel_identities ON contacts USING gin(channel_identities);
CREATE INDEX idx_contacts_tags ON contacts USING gin(tags);
CREATE INDEX idx_contacts_name_trgm ON contacts USING gin(full_name gin_trgm_ops);

-- ═══════════════════════════════════════════════════════════════
-- TABLA: channels
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE channels (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type              channel_type NOT NULL,
  name              VARCHAR(150) NOT NULL,
  external_id       VARCHAR(255),
  credentials       JSONB DEFAULT '{}'::jsonb,
  webhook_url       TEXT,
  webhook_secret    TEXT,
  settings          JSONB DEFAULT '{}'::jsonb,
  active            BOOLEAN DEFAULT true,
  last_error        TEXT,
  last_error_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, type, external_id)
);
CREATE INDEX idx_channels_org ON channels(organization_id);
CREATE INDEX idx_channels_type ON channels(type);
CREATE INDEX idx_channels_external_id ON channels(external_id);
CREATE INDEX idx_channels_active ON channels(active) WHERE active = true;

-- ═══════════════════════════════════════════════════════════════
-- TABLA: conversations
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE conversations (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id              UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  channel_id              UUID NOT NULL REFERENCES channels(id) ON DELETE RESTRICT,
  channel_type            channel_type NOT NULL,
  agent_id                UUID REFERENCES agents(id) ON DELETE SET NULL,
  team_id                 UUID REFERENCES teams(id) ON DELETE SET NULL,
  status                  conversation_status DEFAULT 'open',
  ai_active               BOOLEAN DEFAULT true,
  subject                 VARCHAR(255),
  priority                INT DEFAULT 0,
  tags                    TEXT[] DEFAULT ARRAY[]::TEXT[],
  unread_count            INT DEFAULT 0,
  last_message_at         TIMESTAMPTZ,
  last_message_preview    VARCHAR(500),
  first_response_at       TIMESTAMPTZ,
  handoff_at              TIMESTAMPTZ,
  assigned_at             TIMESTAMPTZ,
  resolved_at             TIMESTAMPTZ,
  resolved_by             UUID REFERENCES users(id) ON DELETE SET NULL,
  csat_score              INT CHECK (csat_score BETWEEN 1 AND 5),
  csat_feedback           TEXT,
  sla_due_at              TIMESTAMPTZ,
  sla_breached            BOOLEAN DEFAULT false,
  ai_tokens_used          INT DEFAULT 0,
  metadata                JSONB DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_conversations_org ON conversations(organization_id);
CREATE INDEX idx_conversations_contact ON conversations(contact_id);
CREATE INDEX idx_conversations_agent ON conversations(agent_id);
CREATE INDEX idx_conversations_team ON conversations(team_id);
CREATE INDEX idx_conversations_channel ON conversations(channel_id);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC);
CREATE INDEX idx_conversations_tags ON conversations USING gin(tags);
CREATE INDEX idx_conversations_open ON conversations(organization_id, last_message_at DESC)
  WHERE status IN ('open', 'pending');

-- ═══════════════════════════════════════════════════════════════
-- TABLA: messages
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE messages (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id   UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sender_type       sender_type NOT NULL,
  sender_id         UUID,
  content           TEXT,
  content_type      content_type DEFAULT 'text',
  media_url         TEXT,
  media_metadata    JSONB DEFAULT '{}'::jsonb,
  external_id       VARCHAR(255),
  status            message_status DEFAULT 'pending',
  error_message     TEXT,
  ai_tokens_used    INT,
  ai_model          VARCHAR(100),
  reply_to_id       UUID REFERENCES messages(id) ON DELETE SET NULL,
  metadata          JSONB DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_org ON messages(organization_id);
CREATE INDEX idx_messages_external ON messages(external_id) WHERE external_id IS NOT NULL;
CREATE INDEX idx_messages_sender ON messages(sender_type, sender_id);
CREATE INDEX idx_messages_content_trgm ON messages USING gin(content gin_trgm_ops);

-- ═══════════════════════════════════════════════════════════════
-- TABLA: flows — constructor visual
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE flows (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name              VARCHAR(150) NOT NULL,
  description       TEXT,
  trigger_type      VARCHAR(50) NOT NULL,
  trigger_config    JSONB DEFAULT '{}'::jsonb,
  nodes             JSONB DEFAULT '[]'::jsonb,
  edges             JSONB DEFAULT '[]'::jsonb,
  active            BOOLEAN DEFAULT false,
  version           INT DEFAULT 1,
  stats             JSONB DEFAULT '{}'::jsonb,
  created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_flows_org ON flows(organization_id);
CREATE INDEX idx_flows_active ON flows(active) WHERE active = true;

-- ═══════════════════════════════════════════════════════════════
-- TABLA: knowledge_base — RAG con pgvector
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE knowledge_base (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title             VARCHAR(255) NOT NULL,
  source_type       VARCHAR(50) DEFAULT 'manual',
  source_url        TEXT,
  content           TEXT NOT NULL,
  content_chunks    JSONB DEFAULT '[]'::jsonb,
  embedding         VECTOR(1536),
  tags              TEXT[] DEFAULT ARRAY[]::TEXT[],
  active            BOOLEAN DEFAULT true,
  created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_kb_org ON knowledge_base(organization_id);
CREATE INDEX idx_kb_active ON knowledge_base(active) WHERE active = true;
CREATE INDEX idx_kb_tags ON knowledge_base USING gin(tags);
CREATE INDEX idx_kb_embedding ON knowledge_base USING hnsw (embedding vector_cosine_ops);

-- ═══════════════════════════════════════════════════════════════
-- TABLA: tags
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE tags (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name              VARCHAR(100) NOT NULL,
  color             VARCHAR(10) DEFAULT '#94a3b8',
  description       TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, name)
);
CREATE INDEX idx_tags_org ON tags(organization_id);

-- ═══════════════════════════════════════════════════════════════
-- TABLA: notes — internas de agentes
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE notes (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id   UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  author_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content           TEXT NOT NULL,
  pinned             BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_notes_conversation ON notes(conversation_id, created_at DESC);
CREATE INDEX idx_notes_author ON notes(author_id);

-- ═══════════════════════════════════════════════════════════════
-- TABLA: metrics_daily
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE metrics_daily (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id                UUID REFERENCES agents(id) ON DELETE CASCADE,
  team_id                 UUID REFERENCES teams(id) ON DELETE CASCADE,
  date                    DATE NOT NULL,
  conversations_total     INT DEFAULT 0,
  conversations_resolved  INT DEFAULT 0,
  conversations_abandoned INT DEFAULT 0,
  messages_sent           INT DEFAULT 0,
  messages_received       INT DEFAULT 0,
  avg_first_response_sec  INT,
  avg_resolution_sec      INT,
  avg_csat                NUMERIC(3,2),
  sla_breaches            INT DEFAULT 0,
  ai_tokens_used          BIGINT DEFAULT 0,
  handoffs                INT DEFAULT 0,
  stats                   JSONB DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX idx_metrics_unique_agent ON metrics_daily(organization_id, agent_id, date)
  WHERE agent_id IS NOT NULL;
CREATE UNIQUE INDEX idx_metrics_unique_team ON metrics_daily(organization_id, team_id, date)
  WHERE team_id IS NOT NULL AND agent_id IS NULL;
CREATE INDEX idx_metrics_org_date ON metrics_daily(organization_id, date DESC);

-- ═══════════════════════════════════════════════════════════════
-- TABLA: audit_logs
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE audit_logs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id           UUID REFERENCES users(id) ON DELETE SET NULL,
  action            VARCHAR(100) NOT NULL,
  entity_type       VARCHAR(50),
  entity_id         UUID,
  changes           JSONB,
  ip_address        INET,
  user_agent        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_audit_org_date ON audit_logs(organization_id, created_at DESC);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_action ON audit_logs(action);

-- ═══════════════════════════════════════════════════════════════
-- COMENTARIOS
-- ═══════════════════════════════════════════════════════════════
COMMENT ON TABLE organizations   IS 'Tenant raíz. Multi-tenancy por org.';
COMMENT ON TABLE users           IS 'Usuarios internos del panel. 1:1 con auth.users.';
COMMENT ON TABLE contacts        IS 'Clientes finales. Unificados por organización.';
COMMENT ON TABLE conversations   IS 'Hilo activo por canal × contacto.';
COMMENT ON TABLE messages        IS 'Append-only. No se editan mensajes históricos.';
COMMENT ON TABLE channels        IS 'Config de canales. Credenciales deben estar cifradas.';
COMMENT ON TABLE knowledge_base  IS 'Documentos para RAG con pgvector (cosine).';
COMMENT ON TABLE metrics_daily   IS 'Pre-agregadas por cron/triggers para el dashboard.';
