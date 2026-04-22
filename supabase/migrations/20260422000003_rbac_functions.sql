-- Ruta: /supabase/migrations/20260422000003_rbac_functions.sql
-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN 6 — FUNCIONES RBAC + MIGRACIÓN DE DATOS EXISTENTES
-- - has_permission(user, key, scope, team_id) → la función más usada
-- - get_user_permissions(user) → para el frontend
-- - migrar users.role → user_roles (un registro por cada usuario existente)
-- - trigger de auditoría automática
-- - RLS de las nuevas tablas
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- FUNCIÓN: has_permission
-- Lógica de resolución de permisos (orden de prioridad):
--   1. Si user_permissions tiene un DENY explícito → DENY.
--   2. Si user_permissions tiene un GRANT → GRANT.
--   3. Si algún user_role (no expirado) tiene el permiso → GRANT.
--   4. Si el user tiene rol 'super_admin' → GRANT (wildcard).
--   5. Si el permiso es scopeable, verifica que el scope solicitado
--      esté cubierto: all > team > own.
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.has_permission(
  p_user_id         UUID,
  p_permission_key  TEXT,
  p_required_scope  permission_scope DEFAULT 'all',
  p_team_id         UUID DEFAULT NULL,
  p_resource_owner  UUID DEFAULT NULL  -- para scope 'own': el dueño del recurso
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_super_admin BOOLEAN;
  v_has_deny       BOOLEAN;
  v_highest_scope  permission_scope;
BEGIN
  -- 0) Usuario activo?
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id AND active = true) THEN
    RETURN false;
  END IF;

  -- 1) ¿Es super_admin? Wildcard absoluto.
  SELECT EXISTS(
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = p_user_id
      AND r.key = 'super_admin'
      AND (ur.expires_at IS NULL OR ur.expires_at > now())
  ) INTO v_is_super_admin;
  IF v_is_super_admin THEN RETURN true; END IF;

  -- 2) ¿Deny explícito en user_permissions?
  SELECT EXISTS(
    SELECT 1
    FROM user_permissions up
    JOIN permissions p ON p.id = up.permission_id
    WHERE up.user_id = p_user_id
      AND p.key = p_permission_key
      AND up.grant = false
      AND (up.expires_at IS NULL OR up.expires_at > now())
  ) INTO v_has_deny;
  IF v_has_deny THEN RETURN false; END IF;

  -- 3) Buscar el scope MÁS AMPLIO que el usuario tiene para este permiso
  --    combinando user_permissions (grant=true) + role_permissions.
  --    Orden de scope: all > team > own
  SELECT CASE
    WHEN bool_or(scope = 'all')  THEN 'all'::permission_scope
    WHEN bool_or(scope = 'team') THEN 'team'::permission_scope
    WHEN bool_or(scope = 'own')  THEN 'own'::permission_scope
    ELSE NULL
  END
  INTO v_highest_scope
  FROM (
    -- Permisos vía roles
    SELECT rp.scope
    FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = p_user_id
      AND p.key = p_permission_key
      AND (ur.expires_at IS NULL OR ur.expires_at > now())
      -- Si el rol está limitado a un team, el recurso debe ser de ese team
      AND (ur.team_id IS NULL OR ur.team_id = p_team_id)

    UNION ALL

    -- Permisos directos (override positivo)
    SELECT up.scope
    FROM user_permissions up
    JOIN permissions p ON p.id = up.permission_id
    WHERE up.user_id = p_user_id
      AND p.key = p_permission_key
      AND up.grant = true
      AND (up.expires_at IS NULL OR up.expires_at > now())
  ) perms;

  IF v_highest_scope IS NULL THEN RETURN false; END IF;

  -- 4) Comparar scope obtenido vs. scope requerido
  RETURN CASE p_required_scope
    WHEN 'own'  THEN v_highest_scope IN ('own', 'team', 'all')
    WHEN 'team' THEN v_highest_scope IN ('team', 'all')
    WHEN 'all'  THEN v_highest_scope = 'all'
  END;
END;
$$;

COMMENT ON FUNCTION public.has_permission IS 'Verifica si un usuario tiene un permiso con el scope requerido. Es la función central del RBAC.';

-- ═══════════════════════════════════════════════════════════════
-- FUNCIÓN: get_user_permissions
-- Devuelve todos los permisos efectivos de un usuario.
-- Llamar UNA VEZ al login; cachear en el frontend.
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_user_permissions(p_user_id UUID)
RETURNS TABLE (
  permission_key TEXT,
  scope          permission_scope,
  source         TEXT   -- 'role:<name>' o 'direct'
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Si es super_admin, retornar wildcard
  IF EXISTS(
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = p_user_id
      AND r.key = 'super_admin'
      AND (ur.expires_at IS NULL OR ur.expires_at > now())
  ) THEN
    RETURN QUERY SELECT '*'::TEXT, 'all'::permission_scope, 'role:super_admin'::TEXT;
    RETURN;
  END IF;

  RETURN QUERY
  WITH
  -- Permisos vía roles
  via_roles AS (
    SELECT p.key AS permission_key,
           rp.scope,
           'role:' || r.key AS source
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = p_user_id
      AND (ur.expires_at IS NULL OR ur.expires_at > now())
  ),
  -- Permisos directos (grant=true)
  via_direct AS (
    SELECT p.key AS permission_key,
           up.scope,
           'direct'::TEXT AS source
    FROM user_permissions up
    JOIN permissions p ON p.id = up.permission_id
    WHERE up.user_id = p_user_id
      AND up.grant = true
      AND (up.expires_at IS NULL OR up.expires_at > now())
  ),
  -- Denies directos (grant=false) para filtrar
  denies AS (
    SELECT p.key AS permission_key
    FROM user_permissions up
    JOIN permissions p ON p.id = up.permission_id
    WHERE up.user_id = p_user_id
      AND up.grant = false
      AND (up.expires_at IS NULL OR up.expires_at > now())
  ),
  combined AS (
    SELECT * FROM via_roles
    UNION ALL
    SELECT * FROM via_direct
  )
  SELECT c.permission_key, c.scope, c.source
  FROM combined c
  WHERE NOT EXISTS (SELECT 1 FROM denies d WHERE d.permission_key = c.permission_key);
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- FUNCIÓN: current_user_has
-- Helper para usar en policies RLS — sin pasar user_id explícito
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.current_user_has(
  p_permission_key  TEXT,
  p_required_scope  permission_scope DEFAULT 'all',
  p_team_id         UUID DEFAULT NULL,
  p_resource_owner  UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_permission(auth.uid(), p_permission_key, p_required_scope, p_team_id, p_resource_owner);
$$;

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN DE DATOS: users.role → user_roles
-- Cada usuario existente recibe el rol del sistema que le corresponde.
-- ═══════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_user RECORD;
  v_role_id UUID;
BEGIN
  FOR v_user IN SELECT id, organization_id, role FROM users LOOP
    SELECT id INTO v_role_id
      FROM roles
      WHERE is_system = true AND key = v_user.role::TEXT;

    IF v_role_id IS NOT NULL THEN
      INSERT INTO user_roles (user_id, role_id, organization_id, granted_reason)
      VALUES (v_user.id, v_role_id, v_user.organization_id, 'Migración automática del sistema legacy')
      ON CONFLICT (user_id, role_id, team_id) DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- TRIGGER: auditoría de cambios en user_roles y user_permissions
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.audit_rbac_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_actor_email TEXT;
  v_target_email TEXT;
  v_entity_name TEXT;
  v_action TEXT;
  v_target_user UUID;
  v_org_id UUID;
BEGIN
  -- Quién
  SELECT email INTO v_actor_email FROM users WHERE id = auth.uid();

  -- Determinar target y org según tabla y operación
  IF TG_TABLE_NAME = 'user_roles' THEN
    IF TG_OP = 'INSERT' THEN
      v_target_user := NEW.user_id;
      v_org_id := NEW.organization_id;
      v_action := 'role.granted';
      SELECT name INTO v_entity_name FROM roles WHERE id = NEW.role_id;
    ELSIF TG_OP = 'DELETE' THEN
      v_target_user := OLD.user_id;
      v_org_id := OLD.organization_id;
      v_action := 'role.revoked';
      SELECT name INTO v_entity_name FROM roles WHERE id = OLD.role_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'user_permissions' THEN
    IF TG_OP = 'INSERT' THEN
      v_target_user := NEW.user_id;
      v_org_id := NEW.organization_id;
      v_action := CASE WHEN NEW.grant THEN 'permission.granted' ELSE 'permission.denied' END;
      SELECT key INTO v_entity_name FROM permissions WHERE id = NEW.permission_id;
    ELSIF TG_OP = 'DELETE' THEN
      v_target_user := OLD.user_id;
      v_org_id := OLD.organization_id;
      v_action := 'permission.removed';
      SELECT key INTO v_entity_name FROM permissions WHERE id = OLD.permission_id;
    END IF;
  END IF;

  SELECT email INTO v_target_email FROM users WHERE id = v_target_user;

  INSERT INTO permission_audit_log (
    organization_id, actor_id, actor_email,
    target_user_id, target_email,
    action, entity_type, entity_id, entity_name,
    before_state, after_state
  )
  VALUES (
    v_org_id, auth.uid(), v_actor_email,
    v_target_user, v_target_email,
    v_action, TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    v_entity_name,
    CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP = 'INSERT' THEN to_jsonb(NEW) ELSE NULL END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_audit_user_roles
  AFTER INSERT OR DELETE ON user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_rbac_change();

CREATE TRIGGER trg_audit_user_permissions
  AFTER INSERT OR DELETE ON user_permissions
  FOR EACH ROW EXECUTE FUNCTION public.audit_rbac_change();

-- ═══════════════════════════════════════════════════════════════
-- TRIGGER: updated_at en roles (ya existe función set_updated_at)
-- ═══════════════════════════════════════════════════════════════
CREATE TRIGGER trg_roles_updated_at
  BEFORE UPDATE ON roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- RLS EN LAS NUEVAS TABLAS
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE permissions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE permission_audit_log   ENABLE ROW LEVEL SECURITY;

-- ─── permissions (catálogo global) ────────────────────────────
CREATE POLICY "permissions_select_authenticated" ON permissions
  FOR SELECT USING (auth.role() = 'authenticated');

-- ─── roles ────────────────────────────────────────────────────
CREATE POLICY "roles_select_same_org_or_system" ON roles
  FOR SELECT USING (
    is_system = true
    OR organization_id = public.current_user_org_id()
  );

CREATE POLICY "roles_insert_with_permission" ON roles
  FOR INSERT WITH CHECK (
    organization_id = public.current_user_org_id()
    AND public.current_user_has('roles.create')
    AND is_system = false
  );

CREATE POLICY "roles_update_with_permission" ON roles
  FOR UPDATE USING (
    organization_id = public.current_user_org_id()
    AND public.current_user_has('roles.update')
    AND is_system = false
  );

CREATE POLICY "roles_delete_with_permission" ON roles
  FOR DELETE USING (
    organization_id = public.current_user_org_id()
    AND public.current_user_has('roles.delete')
    AND is_system = false
  );

-- ─── role_permissions ─────────────────────────────────────────
CREATE POLICY "role_permissions_select_same_org" ON role_permissions
  FOR SELECT USING (
    role_id IN (
      SELECT id FROM roles
      WHERE is_system = true OR organization_id = public.current_user_org_id()
    )
  );

CREATE POLICY "role_permissions_manage" ON role_permissions
  FOR ALL USING (
    role_id IN (
      SELECT id FROM roles
      WHERE organization_id = public.current_user_org_id()
        AND is_system = false
    )
    AND public.current_user_has('roles.update')
  )
  WITH CHECK (
    role_id IN (
      SELECT id FROM roles
      WHERE organization_id = public.current_user_org_id()
        AND is_system = false
    )
  );

-- ─── user_roles ───────────────────────────────────────────────
CREATE POLICY "user_roles_select_same_org" ON user_roles
  FOR SELECT USING (
    organization_id = public.current_user_org_id()
    AND (
      user_id = auth.uid()   -- ver sus propios roles
      OR public.current_user_has('users.read')
    )
  );

CREATE POLICY "user_roles_insert_with_permission" ON user_roles
  FOR INSERT WITH CHECK (
    organization_id = public.current_user_org_id()
    AND public.current_user_has('users.assign_roles')
  );

CREATE POLICY "user_roles_delete_with_permission" ON user_roles
  FOR DELETE USING (
    organization_id = public.current_user_org_id()
    AND public.current_user_has('users.assign_roles')
  );

-- ─── user_permissions ─────────────────────────────────────────
CREATE POLICY "user_permissions_select_same_org" ON user_permissions
  FOR SELECT USING (
    organization_id = public.current_user_org_id()
    AND (user_id = auth.uid() OR public.current_user_has('users.read'))
  );

CREATE POLICY "user_permissions_manage" ON user_permissions
  FOR ALL USING (
    organization_id = public.current_user_org_id()
    AND public.current_user_has('users.assign_roles')
  )
  WITH CHECK (organization_id = public.current_user_org_id());

-- ─── invitations ──────────────────────────────────────────────
CREATE POLICY "invitations_select_same_org" ON invitations
  FOR SELECT USING (
    organization_id = public.current_user_org_id()
    AND public.current_user_has('users.invite')
  );

CREATE POLICY "invitations_insert_with_permission" ON invitations
  FOR INSERT WITH CHECK (
    organization_id = public.current_user_org_id()
    AND public.current_user_has('users.invite')
  );

CREATE POLICY "invitations_update_with_permission" ON invitations
  FOR UPDATE USING (
    organization_id = public.current_user_org_id()
    AND public.current_user_has('users.invite')
  );

-- ─── audit log ────────────────────────────────────────────────
CREATE POLICY "audit_log_read" ON permission_audit_log
  FOR SELECT USING (
    organization_id = public.current_user_org_id()
    AND public.current_user_has('audit.read')
  );

-- ═══════════════════════════════════════════════════════════════
-- AJUSTE: deprecar users.role (sin eliminar por compatibilidad)
-- Agregamos un comentario para marcar que no debe usarse.
-- ═══════════════════════════════════════════════════════════════
COMMENT ON COLUMN users.role IS 'DEPRECATED: Se mantiene por compatibilidad. La fuente de verdad son user_roles + roles + permissions.';
