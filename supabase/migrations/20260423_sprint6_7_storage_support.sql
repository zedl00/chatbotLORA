-- ═══════════════════════════════════════════════════════════════
-- Sprint 6 + 7 — Multi-tenant support mode + branding editor
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- SPRINT 7: Bucket de Storage para logos de organizaciones
-- ─────────────────────────────────────────────────────────────

-- Crear el bucket si no existe (idempotente)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'organization-logos',
  'organization-logos',
  true,  -- acceso público para poder mostrar logos en el widget
  2097152,  -- 2 MB máximo por archivo
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Policies para el bucket
-- Todos pueden LEER (necesario para mostrar logos en el widget público)
DROP POLICY IF EXISTS "organization_logos_public_read" ON storage.objects;
CREATE POLICY "organization_logos_public_read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'organization-logos');

-- Solo usuarios autenticados con settings.update pueden SUBIR
-- y solo a la carpeta de su propia organización
DROP POLICY IF EXISTS "organization_logos_upload" ON storage.objects;
CREATE POLICY "organization_logos_upload" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'organization-logos'
    AND (
      -- super_admin puede subir a cualquier org
      EXISTS (
        SELECT 1 FROM users u
         WHERE u.id = auth.uid() AND u.role = 'super_admin'
      )
      OR
      -- admin de su propia org puede subir
      (
        (storage.foldername(name))[1] = current_user_org_id()::TEXT
        AND current_user_has('settings.update')
      )
    )
  );

-- Solo admins de la org pueden ACTUALIZAR/BORRAR archivos
DROP POLICY IF EXISTS "organization_logos_update" ON storage.objects;
CREATE POLICY "organization_logos_update" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'organization-logos'
    AND (
      EXISTS (
        SELECT 1 FROM users u
         WHERE u.id = auth.uid() AND u.role = 'super_admin'
      )
      OR
      (
        (storage.foldername(name))[1] = current_user_org_id()::TEXT
        AND current_user_has('settings.update')
      )
    )
  );

DROP POLICY IF EXISTS "organization_logos_delete" ON storage.objects;
CREATE POLICY "organization_logos_delete" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'organization-logos'
    AND (
      EXISTS (
        SELECT 1 FROM users u
         WHERE u.id = auth.uid() AND u.role = 'super_admin'
      )
      OR
      (
        (storage.foldername(name))[1] = current_user_org_id()::TEXT
        AND current_user_has('settings.update')
      )
    )
  );


-- ─────────────────────────────────────────────────────────────
-- SPRINT 6: Función auxiliar para logs de auditoría en modo soporte
-- ─────────────────────────────────────────────────────────────

-- Función que registra una acción de super_admin operando en otra org
CREATE OR REPLACE FUNCTION public.log_support_mode_action(
  p_target_org_id UUID,
  p_action        VARCHAR,
  p_entity_type   VARCHAR DEFAULT NULL,
  p_entity_id     UUID    DEFAULT NULL,
  p_details       JSONB   DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_caller_role user_role;
  v_log_id      UUID;
BEGIN
  -- Solo super_admin puede llamar esto
  SELECT u.role INTO v_caller_role FROM users u WHERE u.id = auth.uid();

  IF v_caller_role <> 'super_admin' THEN
    RAISE EXCEPTION 'Solo super_admin puede registrar acciones de soporte';
  END IF;

  INSERT INTO audit_logs (
    organization_id,
    user_id,
    action,
    entity_type,
    entity_id,
    changes
  ) VALUES (
    p_target_org_id,
    auth.uid(),
    'support_mode.' || p_action,
    p_entity_type,
    p_entity_id,
    p_details || jsonb_build_object('support_mode', true)
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.log_support_mode_action(UUID, VARCHAR, VARCHAR, UUID, JSONB) TO authenticated;


-- ─────────────────────────────────────────────────────────────
-- VERIFICACIÓN
-- ─────────────────────────────────────────────────────────────
SELECT
  'Sprint 6+7 migración aplicada' AS status,
  (SELECT COUNT(*) FROM storage.buckets WHERE id = 'organization-logos') AS buckets_creados,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname LIKE 'organization_logos_%') AS policies_storage,
  (SELECT COUNT(*) FROM information_schema.routines WHERE routine_name = 'log_support_mode_action') AS funciones;

-- Esperado:
--   status='Sprint 6+7 migración aplicada'
--   buckets_creados=1
--   policies_storage=4 (read + upload + update + delete)
--   funciones=1
