-- ═══════════════════════════════════════════════════════════════
-- Sprint 11 · Widget Update + Pre-chat + Post-chat
--
-- Contenido:
--   1. Default settings para widgets existentes (backward compatible)
--   2. Permiso channels.configure (ya existe probablemente, pero aseguramos)
--   3. Helper function: get_widget_public_config (expone settings sin secretos)
--   4. Extension de contacts para guardar "motivo" en custom_fields
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. Inicializar settings default para widgets existentes
-- Solo si están vacíos (no sobrescribe configs previas)
-- ─────────────────────────────────────────────────────────────
UPDATE channels
SET settings = jsonb_build_object(
  'branding', jsonb_build_object(
    'primary_color', '#0071E3',
    'position', 'right',
    'offset_x', 20,
    'offset_y', 20,
    'logo_url', null,
    'brand_name', 'Asistente',
    'welcome_message', '¡Hola! ¿En qué puedo ayudarte?',
    'placeholder', 'Escribe tu mensaje...'
  ),
  'pre_chat', jsonb_build_object(
    'enabled', false,
    'mode', 'required',
    'submit_label', 'Iniciar conversación',
    'skip_label', 'Chatear como invitado',
    'title', 'Antes de empezar',
    'subtitle', 'Ayúdanos a atenderte mejor',
    'fields', jsonb_build_array(
      jsonb_build_object('key', 'name',   'visible', true,  'required', true,  'order', 1, 'label', 'Nombre',    'placeholder', 'Tu nombre'),
      jsonb_build_object('key', 'email',  'visible', true,  'required', true,  'order', 2, 'label', 'Email',     'placeholder', 'tu@email.com'),
      jsonb_build_object('key', 'phone',  'visible', false, 'required', false, 'order', 3, 'label', 'Teléfono',  'placeholder', '+1 809 555 0000'),
      jsonb_build_object('key', 'reason', 'visible', false, 'required', false, 'order', 4, 'label', 'Motivo',
                         'options', jsonb_build_array('Ventas', 'Soporte', 'Facturación', 'Otro'))
    )
  ),
  'post_chat', jsonb_build_object(
    'enabled', false,
    'ask_csat', true,
    'title', '¿Cómo fue tu atención?',
    'subtitle', 'Tu opinión nos ayuda a mejorar',
    'thank_you_message', '¡Gracias por tu tiempo!',
    'comment_enabled', false,
    'comment_placeholder', 'Cuéntanos más (opcional)'
  )
)
WHERE type = 'web_widget'
  AND (settings IS NULL OR settings = '{}'::jsonb);


-- ─────────────────────────────────────────────────────────────
-- 2. Helper function: obtener config pública del widget
-- Usado por la Edge Function para devolver settings sin secretos
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_widget_public_config(p_channel_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT settings - 'credentials'  -- remover cualquier campo sensible si se colara
  FROM channels
  WHERE id = p_channel_id
    AND type = 'web_widget'
    AND active = true;
$$;

GRANT EXECUTE ON FUNCTION get_widget_public_config(UUID) TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────
-- 3. Permiso para configurar widget (si no existe)
-- ─────────────────────────────────────────────────────────────
INSERT INTO permissions (key, resource, action, description, scopeable, category, is_dangerous, sort_order)
VALUES
  ('channels.configure', 'channels', 'configure', 'Configurar widget y canales', false, 'channels', false, 310)
ON CONFLICT (key) DO NOTHING;

DO $$
DECLARE
  v_admin_role UUID;
  v_supervisor_role UUID;
  v_perm_id UUID;
BEGIN
  SELECT id INTO v_admin_role FROM roles WHERE is_system = true AND key = 'admin' LIMIT 1;
  SELECT id INTO v_supervisor_role FROM roles WHERE is_system = true AND key = 'supervisor' LIMIT 1;
  SELECT id INTO v_perm_id FROM permissions WHERE key = 'channels.configure';

  IF v_perm_id IS NOT NULL THEN
    IF v_admin_role IS NOT NULL THEN
      INSERT INTO role_permissions (role_id, permission_id, scope)
      VALUES (v_admin_role, v_perm_id, 'all') ON CONFLICT DO NOTHING;
    END IF;

    IF v_supervisor_role IS NOT NULL THEN
      INSERT INTO role_permissions (role_id, permission_id, scope)
      VALUES (v_supervisor_role, v_perm_id, 'team') ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END $$;


COMMIT;


-- ─────────────────────────────────────────────────────────────
-- Verificaciones
-- ─────────────────────────────────────────────────────────────
SELECT 'widgets_with_settings' AS check_, COUNT(*) AS count_
FROM channels
WHERE type = 'web_widget' AND settings != '{}'::jsonb;

SELECT 'helper_function' AS check_, EXISTS (
  SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_widget_public_config'
) AS exists_;

SELECT 'permission_channels_configure' AS check_, EXISTS (
  SELECT 1 FROM permissions WHERE key = 'channels.configure'
) AS exists_;

-- Ver un widget con settings poblado
SELECT id, name, jsonb_pretty(settings) AS settings_formatted
FROM channels
WHERE type = 'web_widget'
LIMIT 1;
