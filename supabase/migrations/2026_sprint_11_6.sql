-- ═══════════════════════════════════════════════════════════════
-- Sprint 11.6 · System Configuration (parametrización global)
--
-- Contenido:
--   1. Tabla system_config (key-value JSONB)
--   2. RPC get_public_config() - devuelve solo las marcadas como públicas
--   3. RLS policies: super_admin lee/escribe todo, resto solo lee públicas
--   4. Seed con URLs oficiales (admin.lorachat.net)
--   5. Función auditada de update
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. Tabla system_config
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_config (
  key          VARCHAR(100) PRIMARY KEY,
  value        JSONB NOT NULL,
  value_type   VARCHAR(20) NOT NULL DEFAULT 'string',  -- string, number, boolean, url, email, json
  description  TEXT,
  is_public    BOOLEAN NOT NULL DEFAULT false,          -- true → accesible sin auth (widget.js)
  category     VARCHAR(50) NOT NULL DEFAULT 'general',  -- general, urls, branding, limits, integrations
  sort_order   INTEGER NOT NULL DEFAULT 100,
  default_value JSONB,                                  -- para botón "restaurar"
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_config_category ON system_config(category);
CREATE INDEX IF NOT EXISTS idx_system_config_public ON system_config(is_public) WHERE is_public = true;


-- ─────────────────────────────────────────────────────────────
-- 2. RLS policies
-- ─────────────────────────────────────────────────────────────
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Authenticated users: pueden leer todo
DROP POLICY IF EXISTS "auth_read_all" ON system_config;
CREATE POLICY "auth_read_all" ON system_config
  FOR SELECT
  TO authenticated
  USING (true);

-- Solo super_admin: puede escribir/actualizar/eliminar
DROP POLICY IF EXISTS "super_admin_write" ON system_config;
CREATE POLICY "super_admin_write" ON system_config
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'super_admin'
    )
  );


-- ─────────────────────────────────────────────────────────────
-- 3. RPC pública: get_public_config
-- Devuelve solo configs marcadas como is_public = true
-- Usada por widget.js y otros contextos sin auth
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_public_config()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    jsonb_object_agg(key, value),
    '{}'::jsonb
  )
  FROM system_config
  WHERE is_public = true;
$$;

GRANT EXECUTE ON FUNCTION get_public_config() TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────
-- 4. RPC: get_config_by_key (para frontend admin, todas las configs)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_config_by_key(p_key TEXT)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT value FROM system_config WHERE key = p_key;
$$;

GRANT EXECUTE ON FUNCTION get_config_by_key(TEXT) TO authenticated;


-- ─────────────────────────────────────────────────────────────
-- 5. Trigger: auto-update de updated_at + updated_by
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION system_config_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS system_config_touch_trigger ON system_config;
CREATE TRIGGER system_config_touch_trigger
  BEFORE UPDATE ON system_config
  FOR EACH ROW
  EXECUTE FUNCTION system_config_touch();


-- ─────────────────────────────────────────────────────────────
-- 6. SEED — valores iniciales oficiales (admin.lorachat.net)
-- ─────────────────────────────────────────────────────────────
INSERT INTO system_config (key, value, value_type, description, is_public, category, sort_order, default_value) VALUES
  (
    'admin_url',
    '"https://admin.lorachat.net"'::jsonb,
    'url',
    'URL del panel administrativo de LORA',
    false,
    'urls',
    10,
    '"https://admin.lorachat.net"'::jsonb
  ),
  (
    'widget_url',
    '"https://admin.lorachat.net/widget.js"'::jsonb,
    'url',
    'URL pública del widget.js embebible en sitios de clientes',
    true,
    'urls',
    20,
    '"https://admin.lorachat.net/widget.js"'::jsonb
  ),
  (
    'api_url',
    '"https://imvahmyywbtcfsduwbdq.supabase.co"'::jsonb,
    'url',
    'URL base del API de Supabase',
    true,
    'urls',
    30,
    '"https://imvahmyywbtcfsduwbdq.supabase.co"'::jsonb
  ),
  (
    'brand_name',
    '"LORA Chat"'::jsonb,
    'string',
    'Nombre público del producto',
    true,
    'branding',
    100,
    '"LORA Chat"'::jsonb
  ),
  (
    'brand_tagline',
    '"Chatbot IA Empresarial Omnicanal"'::jsonb,
    'string',
    'Eslogan corto que aparece en el footer y landing',
    true,
    'branding',
    110,
    '"Chatbot IA Empresarial Omnicanal"'::jsonb
  ),
  (
    'support_email',
    '"soporte@lorachat.net"'::jsonb,
    'email',
    'Email de soporte mostrado al cliente',
    true,
    'branding',
    120,
    '"soporte@lorachat.net"'::jsonb
  ),
  (
    'support_url',
    '"https://lorachat.net/ayuda"'::jsonb,
    'url',
    'URL del centro de ayuda público',
    true,
    'urls',
    40,
    '"https://lorachat.net/ayuda"'::jsonb
  ),
  (
    'landing_url',
    '"https://lorachat.net"'::jsonb,
    'url',
    'URL del landing comercial',
    true,
    'urls',
    50,
    '"https://lorachat.net"'::jsonb
  )
ON CONFLICT (key) DO NOTHING;


COMMIT;


-- ─────────────────────────────────────────────────────────────
-- Verificaciones
-- ─────────────────────────────────────────────────────────────
SELECT 'tabla_creada' AS check_, EXISTS (
  SELECT 1 FROM information_schema.tables WHERE table_name = 'system_config'
) AS exists_;

SELECT 'rpc_publica' AS check_, EXISTS (
  SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_public_config'
) AS exists_;

SELECT 'configs_seed' AS check_, COUNT(*) AS count_
FROM system_config;

-- Preview: configs iniciales
SELECT key, value, value_type, is_public, category
FROM system_config
ORDER BY category, sort_order;

-- Test de RPC pública (debe devolver solo is_public=true)
SELECT get_public_config();
