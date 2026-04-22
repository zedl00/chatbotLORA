-- Ruta: /supabase/migrations/20260421000002_rls_policies.sql
-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN 2 — ROW LEVEL SECURITY (RLS)
-- Primera línea de defensa. Imposible de saltar desde el frontend.
-- Aislamiento estricto por organización y por rol.
-- ═══════════════════════════════════════════════════════════════

-- ── HELPER FUNCTIONS ────────────────────────────────────────────
-- Estas funciones se usan en políticas. Se definen como SECURITY DEFINER
-- y con search_path fijo por seguridad.

-- Devuelve la organization_id del usuario autenticado
CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.users WHERE id = auth.uid();
$$;

-- Devuelve el rol del usuario autenticado
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

-- ¿El usuario tiene rol igual o superior a X? (super_admin > admin > supervisor > agent)
CREATE OR REPLACE FUNCTION public.is_role_at_least(required user_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE public.current_user_role()
    WHEN 'super_admin' THEN TRUE
    WHEN 'admin'       THEN required IN ('admin', 'supervisor', 'agent')
    WHEN 'supervisor'  THEN required IN ('supervisor', 'agent')
    WHEN 'agent'       THEN required = 'agent'
    ELSE FALSE
  END;
$$;

-- ¿El agente pertenece al equipo de este supervisor?
CREATE OR REPLACE FUNCTION public.is_my_team_agent(target_agent_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.agents a
    JOIN public.teams  t ON t.id = a.team_id
    WHERE a.id = target_agent_id
      AND t.supervisor_id = auth.uid()
  );
$$;

-- ═══════════════════════════════════════════════════════════════
-- ACTIVAR RLS EN TODAS LAS TABLAS
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE organizations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams           ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents          ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels        ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE flows           ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags            ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics_daily   ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs      ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════
-- POLÍTICAS: organizations
-- Cada usuario solo puede ver su propia organización.
-- Solo super_admin puede actualizar.
-- ═══════════════════════════════════════════════════════════════
CREATE POLICY "org_select_own" ON organizations
  FOR SELECT USING (id = public.current_user_org_id());

CREATE POLICY "org_update_super_admin" ON organizations
  FOR UPDATE USING (
    id = public.current_user_org_id()
    AND public.current_user_role() = 'super_admin'
  );

-- ═══════════════════════════════════════════════════════════════
-- POLÍTICAS: users
-- Todos los usuarios de la misma org pueden verse.
-- Solo admin+ puede crear/editar/eliminar.
-- Cada usuario puede editar su propio perfil.
-- ═══════════════════════════════════════════════════════════════
CREATE POLICY "users_select_same_org" ON users
  FOR SELECT USING (organization_id = public.current_user_org_id());

CREATE POLICY "users_insert_admin" ON users
  FOR INSERT WITH CHECK (
    organization_id = public.current_user_org_id()
    AND public.is_role_at_least('admin')
  );

CREATE POLICY "users_update_self_or_admin" ON users
  FOR UPDATE USING (
    organization_id = public.current_user_org_id()
    AND (id = auth.uid() OR public.is_role_at_least('admin'))
  );

CREATE POLICY "users_delete_admin" ON users
  FOR DELETE USING (
    organization_id = public.current_user_org_id()
    AND public.is_role_at_least('admin')
  );

-- ═══════════════════════════════════════════════════════════════
-- POLÍTICAS: teams
-- ═══════════════════════════════════════════════════════════════
CREATE POLICY "teams_select_same_org" ON teams
  FOR SELECT USING (organization_id = public.current_user_org_id());

CREATE POLICY "teams_manage_admin" ON teams
  FOR ALL USING (
    organization_id = public.current_user_org_id()
    AND public.is_role_at_least('admin')
  )
  WITH CHECK (organization_id = public.current_user_org_id());

-- ═══════════════════════════════════════════════════════════════
-- POLÍTICAS: agents
-- Todos los de la org pueden ver agentes (para ver quién está online).
-- Solo admin+ puede crear/editar.
-- Cada agente puede actualizar su propio estatus.
-- ═══════════════════════════════════════════════════════════════
CREATE POLICY "agents_select_same_org" ON agents
  FOR SELECT USING (organization_id = public.current_user_org_id());

CREATE POLICY "agents_insert_admin" ON agents
  FOR INSERT WITH CHECK (
    organization_id = public.current_user_org_id()
    AND public.is_role_at_least('admin')
  );

CREATE POLICY "agents_update_self_or_admin" ON agents
  FOR UPDATE USING (
    organization_id = public.current_user_org_id()
    AND (user_id = auth.uid() OR public.is_role_at_least('admin'))
  );

CREATE POLICY "agents_delete_admin" ON agents
  FOR DELETE USING (
    organization_id = public.current_user_org_id()
    AND public.is_role_at_least('admin')
  );

-- ═══════════════════════════════════════════════════════════════
-- POLÍTICAS: contacts
-- Todos los usuarios de la org pueden ver y gestionar contactos.
-- ═══════════════════════════════════════════════════════════════
CREATE POLICY "contacts_all_same_org" ON contacts
  FOR ALL USING (organization_id = public.current_user_org_id())
  WITH CHECK (organization_id = public.current_user_org_id());

-- ═══════════════════════════════════════════════════════════════
-- POLÍTICAS: channels
-- Ver: todos. Gestionar: solo admin+.
-- ═══════════════════════════════════════════════════════════════
CREATE POLICY "channels_select_same_org" ON channels
  FOR SELECT USING (organization_id = public.current_user_org_id());

CREATE POLICY "channels_manage_admin" ON channels
  FOR ALL USING (
    organization_id = public.current_user_org_id()
    AND public.is_role_at_least('admin')
  )
  WITH CHECK (organization_id = public.current_user_org_id());

-- ═══════════════════════════════════════════════════════════════
-- POLÍTICAS: conversations
-- super_admin / admin : ven todas las de su org
-- supervisor          : ven las de su equipo (sin asignar también)
-- agent               : ven solo las suyas y las sin asignar
-- ═══════════════════════════════════════════════════════════════
CREATE POLICY "conversations_select_scoped" ON conversations
  FOR SELECT USING (
    organization_id = public.current_user_org_id()
    AND (
      public.is_role_at_least('admin')
      OR (
        public.current_user_role() = 'supervisor'
        AND (
          agent_id IS NULL
          OR public.is_my_team_agent(agent_id)
        )
      )
      OR (
        public.current_user_role() = 'agent'
        AND (
          agent_id IS NULL
          OR agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid())
        )
      )
    )
  );

CREATE POLICY "conversations_insert_same_org" ON conversations
  FOR INSERT WITH CHECK (organization_id = public.current_user_org_id());

CREATE POLICY "conversations_update_scoped" ON conversations
  FOR UPDATE USING (
    organization_id = public.current_user_org_id()
    AND (
      public.is_role_at_least('admin')
      OR (public.current_user_role() = 'supervisor' AND (agent_id IS NULL OR public.is_my_team_agent(agent_id)))
      OR (public.current_user_role() = 'agent' AND (agent_id IS NULL OR agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid())))
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- POLÍTICAS: messages
-- Hereda scope de su conversación (por eso hay JOIN implícito).
-- Append-only: no se permite UPDATE ni DELETE.
-- ═══════════════════════════════════════════════════════════════
CREATE POLICY "messages_select_scoped" ON messages
  FOR SELECT USING (
    organization_id = public.current_user_org_id()
    AND conversation_id IN (SELECT id FROM conversations)  -- Reusa policy de conversations
  );

CREATE POLICY "messages_insert_same_org" ON messages
  FOR INSERT WITH CHECK (organization_id = public.current_user_org_id());

-- ═══════════════════════════════════════════════════════════════
-- POLÍTICAS: flows / knowledge_base / tags
-- Ver: todos los de la org. Gestionar: solo admin+.
-- ═══════════════════════════════════════════════════════════════
CREATE POLICY "flows_select_same_org" ON flows
  FOR SELECT USING (organization_id = public.current_user_org_id());

CREATE POLICY "flows_manage_admin" ON flows
  FOR ALL USING (
    organization_id = public.current_user_org_id()
    AND public.is_role_at_least('admin')
  )
  WITH CHECK (organization_id = public.current_user_org_id());

CREATE POLICY "kb_select_same_org" ON knowledge_base
  FOR SELECT USING (organization_id = public.current_user_org_id());

CREATE POLICY "kb_manage_admin" ON knowledge_base
  FOR ALL USING (
    organization_id = public.current_user_org_id()
    AND public.is_role_at_least('admin')
  )
  WITH CHECK (organization_id = public.current_user_org_id());

CREATE POLICY "tags_all_same_org" ON tags
  FOR ALL USING (organization_id = public.current_user_org_id())
  WITH CHECK (organization_id = public.current_user_org_id());

-- ═══════════════════════════════════════════════════════════════
-- POLÍTICAS: notes
-- Ver y crear: usuarios de la org con acceso a la conversación.
-- Editar/eliminar: solo el autor o admin+.
-- ═══════════════════════════════════════════════════════════════
CREATE POLICY "notes_select_scoped" ON notes
  FOR SELECT USING (
    organization_id = public.current_user_org_id()
    AND conversation_id IN (SELECT id FROM conversations)
  );

CREATE POLICY "notes_insert_same_org" ON notes
  FOR INSERT WITH CHECK (
    organization_id = public.current_user_org_id()
    AND author_id = auth.uid()
  );

CREATE POLICY "notes_update_author_or_admin" ON notes
  FOR UPDATE USING (
    organization_id = public.current_user_org_id()
    AND (author_id = auth.uid() OR public.is_role_at_least('admin'))
  );

CREATE POLICY "notes_delete_author_or_admin" ON notes
  FOR DELETE USING (
    organization_id = public.current_user_org_id()
    AND (author_id = auth.uid() OR public.is_role_at_least('admin'))
  );

-- ═══════════════════════════════════════════════════════════════
-- POLÍTICAS: metrics_daily
-- Ver: admin+ ve todo, supervisor solo su equipo, agent solo las suyas.
-- Solo se insertan por el sistema (service role), no hay policy INSERT pública.
-- ═══════════════════════════════════════════════════════════════
CREATE POLICY "metrics_select_scoped" ON metrics_daily
  FOR SELECT USING (
    organization_id = public.current_user_org_id()
    AND (
      public.is_role_at_least('admin')
      OR (public.current_user_role() = 'supervisor' AND (agent_id IS NULL OR public.is_my_team_agent(agent_id)))
      OR (public.current_user_role() = 'agent'     AND agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()))
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- POLÍTICAS: audit_logs
-- Solo lectura para admin+, nadie inserta (lo hacen triggers/functions).
-- ═══════════════════════════════════════════════════════════════
CREATE POLICY "audit_select_admin" ON audit_logs
  FOR SELECT USING (
    organization_id = public.current_user_org_id()
    AND public.is_role_at_least('admin')
  );

-- ═══════════════════════════════════════════════════════════════
-- GRANTS para authenticated role
-- ═══════════════════════════════════════════════════════════════
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ALTER DEFAULT PRIVILEGES para tablas futuras
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
