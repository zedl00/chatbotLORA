-- ═══════════════════════════════════════════════════════════════
-- Sprint 5 · Bloque 3 — Multi-tenant con subdominios
-- Migración: RPC para crear organización atómicamente
-- ═══════════════════════════════════════════════════════════════

-- ── Función para buscar org por subdomain (pública, sin auth) ──
-- Necesaria para que el frontend cargue la org antes del login.
-- SECURITY DEFINER permite que la función se ejecute con permisos del
-- owner de la función, saltando el RLS de organizations en este SELECT
-- específico (solo retorna campos públicos).
CREATE OR REPLACE FUNCTION public.get_org_by_subdomain(p_subdomain TEXT)
RETURNS TABLE (
  id            UUID,
  name          VARCHAR,
  subdomain     VARCHAR,
  brand_name    VARCHAR,
  primary_color VARCHAR,
  logo_url      TEXT,
  logo_full_url TEXT,
  active        BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id,
    o.name,
    o.subdomain,
    o.brand_name,
    o.primary_color,
    o.logo_url,
    o.logo_full_url,
    o.active
  FROM organizations o
  WHERE LOWER(o.subdomain) = LOWER(p_subdomain)
    AND o.active = true
  LIMIT 1;
$$;

-- Permitir a todos los roles (incluidos anónimos) llamarla.
GRANT EXECUTE ON FUNCTION public.get_org_by_subdomain(TEXT) TO anon, authenticated;

COMMENT ON FUNCTION public.get_org_by_subdomain IS
  'Busca organización por subdomain. Público, sin auth. Usado por useOrganizationContext() en el frontend.';


-- ═══════════════════════════════════════════════════════════════
-- FUNCIÓN PRINCIPAL: crear organización con todo lo necesario
-- ═══════════════════════════════════════════════════════════════
-- Crea en una transacción atómica:
--   1. La organización
--   2. El rol "admin" para esta org
--   3. Una invitación para el email del admin inicial
--   4. Un canal web_widget default
--   5. Una bot_persona default (si existe esa tabla)
--   6. Una widget_config default con el color y mensaje de bienvenida
--
-- Retorna: { org_id, invitation_token, admin_url }
--
-- Solo ejecutable por usuarios con rol 'super_admin'.
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.create_organization_with_admin(
  p_name              VARCHAR,
  p_subdomain         VARCHAR,
  p_primary_color     VARCHAR DEFAULT '#0071E3',
  p_admin_email       VARCHAR DEFAULT NULL,
  p_welcome_message   TEXT    DEFAULT '¡Hola! ¿En qué te podemos ayudar?',
  p_brand_name        VARCHAR DEFAULT NULL,
  p_logo_url          TEXT    DEFAULT NULL
)
RETURNS TABLE (
  org_id             UUID,
  invitation_token   TEXT,
  admin_role_id      UUID,
  channel_id         UUID,
  widget_config_id   UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role   user_role;
  v_caller_org_id UUID;
  v_org_id        UUID;
  v_role_id       UUID;
  v_channel_id    UUID;
  v_widget_id     UUID;
  v_token         TEXT;
  v_invitation_id UUID;
  v_slug          TEXT;
  v_subdomain_lc  TEXT;
BEGIN
  -- ── Validación de permisos: solo super_admin ──
  SELECT role, organization_id
    INTO v_caller_role, v_caller_org_id
    FROM users
   WHERE id = auth.uid();

  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF v_caller_role <> 'super_admin' THEN
    RAISE EXCEPTION 'Solo super_admin puede crear organizaciones';
  END IF;

  -- ── Normalizar subdomain a minúsculas ──
  v_subdomain_lc := LOWER(TRIM(p_subdomain));

  -- ── Validar formato del subdomain ──
  IF NOT v_subdomain_lc ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$' THEN
    RAISE EXCEPTION 'Subdomain inválido: debe ser minúsculas, números y guiones (2-63 chars)';
  END IF;

  -- ── Validar que no esté reservado ──
  IF EXISTS (SELECT 1 FROM reserved_subdomains WHERE subdomain = v_subdomain_lc) THEN
    RAISE EXCEPTION 'El subdomain "%" está reservado por el sistema', v_subdomain_lc;
  END IF;

  -- ── Validar que no exista ya ──
  IF EXISTS (SELECT 1 FROM organizations WHERE LOWER(subdomain) = v_subdomain_lc) THEN
    RAISE EXCEPTION 'El subdomain "%" ya está en uso', v_subdomain_lc;
  END IF;

  -- ── Validar email si viene ──
  IF p_admin_email IS NOT NULL AND p_admin_email <> '' THEN
    IF p_admin_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
      RAISE EXCEPTION 'Email inválido: %', p_admin_email;
    END IF;
  END IF;

  -- ── Generar slug único a partir del nombre ──
  v_slug := LOWER(REGEXP_REPLACE(TRIM(p_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := TRIM(BOTH '-' FROM v_slug);
  -- Agregar sufijo aleatorio para asegurar unicidad
  v_slug := v_slug || '-' || SUBSTR(MD5(RANDOM()::TEXT), 1, 6);

  -- ═══════════════════════════════════════════════════════════
  -- 1. CREAR LA ORGANIZACIÓN
  -- ═══════════════════════════════════════════════════════════
  INSERT INTO organizations (
    name,
    slug,
    subdomain,
    brand_name,
    primary_color,
    logo_url,
    active,
    timezone,
    locale,
    plan
  ) VALUES (
    p_name,
    v_slug,
    v_subdomain_lc,
    COALESCE(p_brand_name, p_name),
    p_primary_color,
    p_logo_url,
    true,
    'America/Santo_Domingo',
    'es',
    'starter'
  )
  RETURNING id INTO v_org_id;

  -- ═══════════════════════════════════════════════════════════
  -- 2. CREAR ROL "admin" PARA ESTA ORG
  -- ═══════════════════════════════════════════════════════════
  -- Copia los permisos del rol system_admin (si existe uno global)
  -- o crea un rol admin vacío que luego puede personalizar.
  INSERT INTO roles (
    organization_id,
    name,
    description,
    is_system,
    active
  ) VALUES (
    v_org_id,
    'admin',
    'Administrador de la empresa con permisos completos',
    false,
    true
  )
  RETURNING id INTO v_role_id;

  -- Dar todos los permisos al rol admin (excepto super_admin)
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_role_id, p.id
    FROM permissions p
   WHERE p.name NOT LIKE 'super_admin.%';

  -- ═══════════════════════════════════════════════════════════
  -- 3. CREAR CANAL WEB_WIDGET DEFAULT
  -- ═══════════════════════════════════════════════════════════
  INSERT INTO channels (
    organization_id,
    name,
    channel_type,
    active,
    settings
  ) VALUES (
    v_org_id,
    'Widget Web',
    'web_widget',
    true,
    '{}'::jsonb
  )
  RETURNING id INTO v_channel_id;

  -- ═══════════════════════════════════════════════════════════
  -- 4. CREAR WIDGET_CONFIG DEFAULT
  -- ═══════════════════════════════════════════════════════════
  INSERT INTO widget_configs (
    channel_id,
    brand_name,
    primary_color,
    accent_color,
    position,
    launcher_icon,
    welcome_title,
    welcome_subtitle,
    input_placeholder,
    offline_message,
    require_name,
    require_email,
    require_phone,
    pre_chat_message,
    auto_open,
    auto_open_delay_ms,
    show_powered_by
  ) VALUES (
    v_channel_id,
    COALESCE(p_brand_name, p_name),
    p_primary_color,
    p_primary_color,
    'bottom-right',
    '💬',
    COALESCE(p_brand_name, p_name),
    p_welcome_message,
    'Escribe tu mensaje...',
    'Un agente te responderá pronto.',
    false,
    false,
    false,
    '¡Hola! Antes de empezar, cuéntanos un poco sobre ti.',
    false,
    5000,
    true
  )
  RETURNING id INTO v_widget_id;

  -- ═══════════════════════════════════════════════════════════
  -- 5. CREAR BOT_PERSONA DEFAULT (si existe la tabla)
  -- ═══════════════════════════════════════════════════════════
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'bot_personas'
  ) THEN
    EXECUTE format($dyn$
      INSERT INTO bot_personas (
        organization_id,
        name,
        description,
        system_prompt,
        model,
        temperature,
        active,
        is_default
      ) VALUES (
        %L,
        'Asistente por defecto',
        'Personalidad inicial del bot. Puedes personalizarla desde Personalidades IA.',
        'Eres el asistente virtual de %s. Respondes de forma amable, profesional y concisa. Ayudas a los visitantes con sus preguntas sobre productos y servicios.',
        'claude-haiku-4-5',
        0.7,
        true,
        true
      )
    $dyn$, v_org_id, p_name);
  END IF;

  -- ═══════════════════════════════════════════════════════════
  -- 6. CREAR INVITACIÓN PARA EL ADMIN (si viene email)
  -- ═══════════════════════════════════════════════════════════
  IF p_admin_email IS NOT NULL AND p_admin_email <> '' THEN
    v_token := encode(gen_random_bytes(32), 'hex');

    INSERT INTO invitations (
      organization_id,
      email,
      role_id,
      token,
      invited_by,
      expires_at,
      accepted_at,
      metadata
    ) VALUES (
      v_org_id,
      LOWER(TRIM(p_admin_email)),
      v_role_id,
      v_token,
      auth.uid(),
      NOW() + INTERVAL '7 days',
      NULL,
      jsonb_build_object(
        'org_created_at_invitation', true,
        'subdomain', v_subdomain_lc
      )
    )
    RETURNING id INTO v_invitation_id;
  END IF;

  -- ═══════════════════════════════════════════════════════════
  -- 7. LOG DE AUDITORÍA
  -- ═══════════════════════════════════════════════════════════
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'audit_logs'
  ) THEN
    INSERT INTO audit_logs (
      organization_id,
      user_id,
      action,
      entity_type,
      entity_id,
      metadata
    ) VALUES (
      v_org_id,
      auth.uid(),
      'organization.created',
      'organization',
      v_org_id,
      jsonb_build_object(
        'name', p_name,
        'subdomain', v_subdomain_lc,
        'invited_email', p_admin_email
      )
    );
  END IF;

  -- ── Retornar datos importantes ──
  RETURN QUERY SELECT
    v_org_id,
    v_token,
    v_role_id,
    v_channel_id,
    v_widget_id;
END;
$$;

COMMENT ON FUNCTION public.create_organization_with_admin IS
  'Crea una organización completa con canal widget, config, rol admin e invitación. Solo super_admin.';

GRANT EXECUTE ON FUNCTION public.create_organization_with_admin(
  VARCHAR, VARCHAR, VARCHAR, VARCHAR, TEXT, VARCHAR, TEXT
) TO authenticated;


-- ═══════════════════════════════════════════════════════════════
-- FUNCIÓN: listar organizaciones (solo super_admin ve todas)
-- ═══════════════════════════════════════════════════════════════
-- Los admins de empresa ya ven la suya por RLS normal.
-- Esta función existe para que super_admin vea TODAS las orgs.
CREATE OR REPLACE FUNCTION public.list_all_organizations()
RETURNS TABLE (
  id              UUID,
  name            VARCHAR,
  slug            VARCHAR,
  subdomain       VARCHAR,
  brand_name      VARCHAR,
  primary_color   VARCHAR,
  logo_url        TEXT,
  active          BOOLEAN,
  plan            VARCHAR,
  created_at      TIMESTAMPTZ,
  user_count      BIGINT,
  conversation_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role user_role;
BEGIN
  SELECT role INTO v_caller_role FROM users WHERE id = auth.uid();

  IF v_caller_role <> 'super_admin' THEN
    RAISE EXCEPTION 'Solo super_admin puede listar todas las organizaciones';
  END IF;

  RETURN QUERY
    SELECT
      o.id,
      o.name,
      o.slug,
      o.subdomain,
      o.brand_name,
      o.primary_color,
      o.logo_url,
      o.active,
      o.plan,
      o.created_at,
      (SELECT COUNT(*) FROM users WHERE organization_id = o.id)::BIGINT AS user_count,
      (SELECT COUNT(*) FROM conversations WHERE organization_id = o.id)::BIGINT AS conversation_count
      FROM organizations o
     ORDER BY o.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_all_organizations() TO authenticated;


-- ═══════════════════════════════════════════════════════════════
-- FUNCIÓN: activar/desactivar organización (soft delete)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.set_organization_active(
  p_org_id UUID,
  p_active BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role user_role;
BEGIN
  SELECT role INTO v_caller_role FROM users WHERE id = auth.uid();

  IF v_caller_role <> 'super_admin' THEN
    RAISE EXCEPTION 'Solo super_admin puede cambiar estado de organizaciones';
  END IF;

  UPDATE organizations SET active = p_active, updated_at = NOW()
   WHERE id = p_org_id;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_organization_active(UUID, BOOLEAN) TO authenticated;


-- ═══════════════════════════════════════════════════════════════
-- POLICY: dejar que super_admin lea TODAS las orgs
-- ═══════════════════════════════════════════════════════════════
-- La policy existente "org_select_own" solo deja ver la propia.
-- Agregamos una adicional para super_admin.
DROP POLICY IF EXISTS "org_select_super_admin" ON organizations;
CREATE POLICY "org_select_super_admin" ON organizations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
       WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- VERIFICACIÓN: este SELECT te dice si todo quedó bien
-- ═══════════════════════════════════════════════════════════════
SELECT
  'Funciones creadas' AS check_name,
  COUNT(*) AS count
  FROM information_schema.routines
 WHERE routine_schema = 'public'
   AND routine_name IN (
     'get_org_by_subdomain',
     'create_organization_with_admin',
     'list_all_organizations',
     'set_organization_active'
   );
-- Resultado esperado: count = 4
