-- Ruta: /supabase/seed/seed.sql
-- ═══════════════════════════════════════════════════════════════
-- SEED — DATOS INICIALES DE DESARROLLO
-- Ejecutar con: supabase db reset
-- NO usar en producción.
-- ═══════════════════════════════════════════════════════════════

-- Organización demo
INSERT INTO organizations (id, name, slug, timezone, locale, plan) VALUES
  ('00000000-0000-0000-0000-000000000001',
   'Demo Company',
   'demo-company',
   'America/Santo_Domingo',
   'es',
   'starter');

-- Etiquetas
INSERT INTO tags (organization_id, name, color) VALUES
  ('00000000-0000-0000-0000-000000000001', 'urgente',     '#ef4444'),
  ('00000000-0000-0000-0000-000000000001', 'ventas',      '#10b981'),
  ('00000000-0000-0000-0000-000000000001', 'soporte',     '#3b82f6'),
  ('00000000-0000-0000-0000-000000000001', 'queja',       '#f59e0b'),
  ('00000000-0000-0000-0000-000000000001', 'seguimiento', '#8b5cf6');

-- Equipos
INSERT INTO teams (id, organization_id, name, description, color) VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Soporte General', 'Primera línea de atención', '#2b7bff'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Ventas',          'Consultas comerciales',    '#10b981');

-- Canal widget web
INSERT INTO channels (id, organization_id, type, name, external_id, active) VALUES
  ('20000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000001',
   'web_widget',
   'Widget Web — Sitio principal',
   'widget-main',
   true);

-- Flujo bienvenida
INSERT INTO flows (organization_id, name, description, trigger_type, active, nodes) VALUES
  ('00000000-0000-0000-0000-000000000001',
   'Bienvenida',
   'Mensaje inicial cuando un contacto nuevo escribe',
   'welcome',
   true,
   '[{"id":"start","type":"message","data":{"text":"¡Hola! Soy el asistente virtual. ¿En qué puedo ayudarte?"}}]'::jsonb);

-- KB inicial
INSERT INTO knowledge_base (organization_id, title, content, source_type, tags) VALUES
  ('00000000-0000-0000-0000-000000000001',
   'Horario de atención',
   'Nuestro horario de atención es de lunes a viernes de 8:00 AM a 6:00 PM (hora de Santo Domingo). Sábados 9:00 AM a 1:00 PM. Domingos cerrado.',
   'manual',
   ARRAY['horario', 'atencion']);

-- Para crear el primer super_admin, tras registrarse vía app:
--
--   INSERT INTO users (id, organization_id, email, full_name, role)
--   VALUES ('<uuid-de-auth-users>',
--           '00000000-0000-0000-0000-000000000001',
--           'admin@demo.com', 'Super Admin', 'super_admin');
