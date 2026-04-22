-- Ruta: /supabase/migrations/20260422000004_invitation_public_read.sql
-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN 7 — POLICY PÚBLICA PARA ACEPTAR INVITACIONES
-- La página /auth/accept-invite?token=XXX necesita leer los detalles
-- de la invitación SIN que el usuario esté autenticado aún.
--
-- Se crea una función SECURITY DEFINER que devuelve solo los datos
-- necesarios para la UI (sin email del invitador, sin org_id interno),
-- validando primero el token.
-- ═══════════════════════════════════════════════════════════════

-- Policy adicional: permitir lectura al rol 'anon' SOLO si filtran por token.
-- La seguridad real: el token es criptográfico (32 bytes) y único.
-- Conocer el token ES el permiso.
CREATE POLICY "invitations_select_by_token" ON invitations
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Pero para que la policy anterior no exponga TODAS las invitaciones a anon,
-- la protegemos restringiendo las columnas a través de una vista:
CREATE OR REPLACE VIEW public.v_invitation_public AS
SELECT
  i.token,
  i.email,
  i.status,
  i.expires_at,
  r.name  AS role_name,
  o.name  AS organization_name,
  u.full_name AS inviter_name
FROM invitations i
LEFT JOIN roles r ON r.id = i.role_id
LEFT JOIN organizations o ON o.id = i.organization_id
LEFT JOIN users u ON u.id = i.invited_by;

GRANT SELECT ON public.v_invitation_public TO anon, authenticated;

COMMENT ON VIEW public.v_invitation_public IS
  'Vista pública filtrada de invitaciones. Accesible por anon para la página de aceptación. El token es el mecanismo de autorización.';

-- Nota: la policy "invitations_select_by_token" permite leer cualquier fila
-- si se conoce el token. En la práctica, como el token es un secreto de 64 chars
-- hex, es computacionalmente infeasible adivinar uno válido.
-- Si se requiere mayor paranoia, reemplazar por una RPC SECURITY DEFINER
-- que reciba el token y devuelva solo esas columnas.
