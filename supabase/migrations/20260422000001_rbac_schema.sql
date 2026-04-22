-- Ruta: /supabase/migrations/20260422000001_rbac_schema.sql
-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN 4 — RBAC ENTERPRISE
-- Sistema granular de permisos: Users ↔ Roles ↔ Permissions
-- + Invitaciones, delegación temporal, auditoría detallada
-- + Permisos a nivel de recurso (team, conversation, etc.)
-- ═══════════════════════════════════════════════════════════════

-- ── TIPOS ENUM NUEVOS ─────────────────────────────────────────
CREATE TYPE permission_scope AS ENUM ('all', 'team', 'own');
CREATE TYPE invite_status AS ENUM ('pending', 'accepted', 'revoked', 'expired');

-- ═══════════════════════════════════════════════════════════════
-- TABLA: permissions
-- Catálogo GLOBAL de permisos atómicos del sistema.
-- No se crean por org; son los mismos para todas.
-- Formato: "recurso.accion" (ej: "conversations.assign")
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE permissions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key           VARCHAR(100) UNIQUE NOT NULL,  -- ej: "conversations.assign"
  resource      VARCHAR(50)  NOT NULL,         -- ej: "conversations"
  action        VARCHAR(50)  NOT NULL,         -- ej: "assign"
  description   TEXT,
  -- ¿Este permiso admite scope (own/team/all)?
  scopeable     BOOLEAN DEFAULT false,
  category      VARCHAR(50),                   -- para agrupar en la UI
  -- Permiso crítico que solo super_admin puede asignar:
  is_dangerous  BOOLEAN DEFAULT false,
  sort_order    INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_permissions_resource ON permissions(resource);
CREATE INDEX idx_permissions_category ON permissions(category);

-- ═══════════════════════════════════════════════════════════════
-- TABLA: roles
-- Roles por organización. Los "del sistema" (is_system=true)
-- vienen pre-creados y no se pueden borrar.
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE roles (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   UUID REFERENCES organizations(id) ON DELETE CASCADE,
  key               VARCHAR(100) NOT NULL,  -- ej: "super_admin" o "analista_senior"
  name              VARCHAR(150) NOT NULL,
  description       TEXT,
  color             VARCHAR(10) DEFAULT '#64748b',
  icon              VARCHAR(10),
  is_system         BOOLEAN DEFAULT false,  -- roles del sistema no se borran
  priority          INT DEFAULT 0,          -- mayor = más alto en jerarquía
  active            BOOLEAN DEFAULT true,
  created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  -- Los roles del sistema tienen organization_id = NULL (globales)
  -- Los custom pertenecen a una org y su key es única por org
  UNIQUE NULLS NOT DISTINCT (organization_id, key)
);

CREATE INDEX idx_roles_org ON roles(organization_id);
CREATE INDEX idx_roles_system ON roles(is_system) WHERE is_system = true;

-- ═══════════════════════════════════════════════════════════════
-- TABLA: role_permissions
-- Qué permisos tiene cada rol, con su scope.
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE role_permissions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id           UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id     UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  scope             permission_scope DEFAULT 'all',  -- "own" | "team" | "all"
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(role_id, permission_id, scope)
);

CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_perm ON role_permissions(permission_id);

-- ═══════════════════════════════════════════════════════════════
-- TABLA: user_roles
-- Asignación de roles a usuarios (N:M).
-- Un usuario puede tener varios roles simultáneamente.
-- Soporta delegación temporal con expires_at.
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE user_roles (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id           UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Delegación temporal (NULL = permanente)
  expires_at        TIMESTAMPTZ,
  -- Alcance específico (ej: rol "supervisor" pero solo del team_id X)
  team_id           UUID REFERENCES teams(id) ON DELETE CASCADE,
  granted_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  granted_reason    TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role_id, team_id)
);

CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role_id);
CREATE INDEX idx_user_roles_org ON user_roles(organization_id);
CREATE INDEX idx_user_roles_expires ON user_roles(expires_at) WHERE expires_at IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- TABLA: user_permissions
-- Permisos asignados DIRECTAMENTE a un usuario (override).
-- Usar con cuidado: es la excepción, no la regla.
-- grant=true concede, grant=false REVOCA (aunque un rol lo dé).
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE user_permissions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_id     UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  scope             permission_scope DEFAULT 'all',
  grant             BOOLEAN DEFAULT true,  -- true=conceder, false=denegar
  expires_at        TIMESTAMPTZ,
  granted_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  granted_reason    TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, permission_id, scope)
);

CREATE INDEX idx_user_permissions_user ON user_permissions(user_id);
CREATE INDEX idx_user_permissions_org ON user_permissions(organization_id);
CREATE INDEX idx_user_permissions_expires ON user_permissions(expires_at) WHERE expires_at IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- TABLA: invitations
-- Método A: admin envía invitación por email.
-- El user hace clic en el enlace y completa su registro.
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE invitations (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email             VARCHAR(255) NOT NULL,
  -- Token criptográfico enviado en el enlace
  token             TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  -- Rol a asignar al aceptar
  role_id           UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  team_id           UUID REFERENCES teams(id) ON DELETE SET NULL,
  status            invite_status DEFAULT 'pending',
  invited_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  accepted_at       TIMESTAMPTZ,
  accepted_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  revoked_at        TIMESTAMPTZ,
  message           TEXT,                  -- mensaje personal del invitador
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, email, status)   -- no duplicar invitación pendiente
);

CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_org ON invitations(organization_id);
CREATE INDEX idx_invitations_email ON invitations(email);
CREATE INDEX idx_invitations_status ON invitations(status);

-- ═══════════════════════════════════════════════════════════════
-- TABLA: permission_audit_log
-- Auditoría detallada: quién cambió qué permiso de quién.
-- Append-only, ninguna policy de UPDATE/DELETE.
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE permission_audit_log (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Quién hizo el cambio
  actor_id          UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_email       VARCHAR(255),           -- snapshot por si se borra el user
  -- A quién se le cambió algo
  target_user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  target_email      VARCHAR(255),
  -- Qué pasó
  action            VARCHAR(50) NOT NULL,   -- role.granted, role.revoked, perm.granted, invite.sent, etc.
  entity_type       VARCHAR(50),            -- role | permission | invitation
  entity_id         UUID,                   -- id del role/permission/invitation
  entity_name       VARCHAR(255),           -- snapshot del nombre
  -- Contexto completo
  before_state      JSONB,
  after_state       JSONB,
  reason            TEXT,
  ip_address        INET,
  user_agent        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_perm_audit_org_date ON permission_audit_log(organization_id, created_at DESC);
CREATE INDEX idx_perm_audit_actor ON permission_audit_log(actor_id);
CREATE INDEX idx_perm_audit_target ON permission_audit_log(target_user_id);
CREATE INDEX idx_perm_audit_action ON permission_audit_log(action);

-- ═══════════════════════════════════════════════════════════════
-- ÍNDICE: Auto-expirar roles y permisos vencidos
-- Los registros con expires_at < now() se consideran inactivos.
-- Un cron nocturno los limpiará físicamente.
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- COMENTARIOS
-- ═══════════════════════════════════════════════════════════════
COMMENT ON TABLE permissions IS 'Catálogo global inmutable de permisos atómicos.';
COMMENT ON TABLE roles IS 'Roles por org. Los del sistema (is_system=true) no se borran.';
COMMENT ON TABLE user_roles IS 'Asignación N:M user↔role. Un user puede tener varios.';
COMMENT ON TABLE user_permissions IS 'Overrides directos. grant=false revoca aunque un rol lo dé.';
COMMENT ON TABLE invitations IS 'Invitaciones por email con token. Expiran en 7 días.';
COMMENT ON TABLE permission_audit_log IS 'Auditoría append-only de cambios de permisos.';
