-- Ruta: /supabase/migrations/20260422000002_rbac_seed.sql
-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN 5 — SEED INMUTABLE DEL CATÁLOGO RBAC
-- Catálogo global de permisos + roles del sistema.
-- Se ejecuta con ON CONFLICT DO NOTHING para ser idempotente.
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- CATÁLOGO DE PERMISOS — organizados por recurso
-- ═══════════════════════════════════════════════════════════════
INSERT INTO permissions (key, resource, action, description, scopeable, category, is_dangerous, sort_order) VALUES
-- ─── CONVERSATIONS ──────────────────────────────────────────
('conversations.read',          'conversations', 'read',          'Ver conversaciones',                       true,  'Conversaciones', false, 10),
('conversations.create',        'conversations', 'create',        'Crear conversaciones',                     false, 'Conversaciones', false, 11),
('conversations.update',        'conversations', 'update',        'Editar conversaciones (tags, prioridad)',  true,  'Conversaciones', false, 12),
('conversations.assign',        'conversations', 'assign',        'Asignar conversaciones a agentes',         true,  'Conversaciones', false, 13),
('conversations.transfer',      'conversations', 'transfer',      'Transferir entre equipos',                 true,  'Conversaciones', false, 14),
('conversations.resolve',       'conversations', 'resolve',       'Cerrar conversaciones',                    true,  'Conversaciones', false, 15),
('conversations.delete',        'conversations', 'delete',        'Eliminar conversaciones',                  false, 'Conversaciones', true,  16),
('conversations.takeover',      'conversations', 'takeover',      'Tomar conversación de otro agente',        true,  'Conversaciones', false, 17),
('conversations.export',        'conversations', 'export',        'Exportar historial',                       true,  'Conversaciones', false, 18),

-- ─── MESSAGES ──────────────────────────────────────────────
('messages.send',               'messages',      'send',          'Enviar mensajes',                          true,  'Mensajes', false, 20),
('messages.send_media',         'messages',      'send_media',    'Enviar archivos/imágenes/audio',           true,  'Mensajes', false, 21),
('messages.delete',             'messages',      'delete',        'Eliminar mensajes (solo propios)',         false, 'Mensajes', false, 22),

-- ─── NOTES ─────────────────────────────────────────────────
('notes.create',                'notes',         'create',        'Crear notas internas',                     true,  'Notas', false, 25),
('notes.read',                  'notes',         'read',          'Ver notas internas',                       true,  'Notas', false, 26),
('notes.delete',                'notes',         'delete',        'Eliminar notas',                           false, 'Notas', false, 27),

-- ─── CONTACTS ──────────────────────────────────────────────
('contacts.read',               'contacts',      'read',          'Ver contactos',                            false, 'Contactos', false, 30),
('contacts.create',             'contacts',      'create',        'Crear contactos',                          false, 'Contactos', false, 31),
('contacts.update',             'contacts',      'update',        'Editar contactos',                         false, 'Contactos', false, 32),
('contacts.delete',             'contacts',      'delete',        'Eliminar contactos',                       false, 'Contactos', true,  33),
('contacts.export',             'contacts',      'export',        'Exportar base de contactos',               false, 'Contactos', true,  34),
('contacts.block',              'contacts',      'block',         'Bloquear contactos',                       false, 'Contactos', false, 35),

-- ─── CHANNELS ──────────────────────────────────────────────
('channels.read',               'channels',      'read',          'Ver canales configurados',                 false, 'Canales', false, 40),
('channels.create',             'channels',      'create',        'Conectar nuevos canales',                  false, 'Canales', false, 41),
('channels.update',             'channels',      'update',        'Editar configuración de canales',          false, 'Canales', false, 42),
('channels.delete',             'channels',      'delete',        'Desconectar canales',                      false, 'Canales', true,  43),
('channels.view_credentials',   'channels',      'view_credentials', 'Ver tokens/credenciales',               false, 'Canales', true,  44),

-- ─── FLOWS ─────────────────────────────────────────────────
('flows.read',                  'flows',         'read',          'Ver flujos',                               false, 'Flujos IA', false, 50),
('flows.create',                'flows',         'create',        'Crear flujos',                             false, 'Flujos IA', false, 51),
('flows.update',                'flows',         'update',        'Editar flujos',                            false, 'Flujos IA', false, 52),
('flows.publish',               'flows',         'publish',       'Activar/desactivar flujos',                false, 'Flujos IA', false, 53),
('flows.delete',                'flows',         'delete',        'Eliminar flujos',                          false, 'Flujos IA', true,  54),

-- ─── KNOWLEDGE BASE ────────────────────────────────────────
('knowledge.read',              'knowledge',     'read',          'Ver base de conocimiento',                 false, 'Base de Conocimiento', false, 60),
('knowledge.create',            'knowledge',     'create',        'Agregar documentos',                       false, 'Base de Conocimiento', false, 61),
('knowledge.update',            'knowledge',     'update',        'Editar documentos',                        false, 'Base de Conocimiento', false, 62),
('knowledge.delete',            'knowledge',     'delete',        'Eliminar documentos',                      false, 'Base de Conocimiento', false, 63),

-- ─── AGENTS / TEAMS ────────────────────────────────────────
('agents.read',                 'agents',        'read',          'Ver lista de agentes',                     true,  'Equipo', false, 70),
('agents.create',               'agents',        'create',        'Dar de alta agentes',                      false, 'Equipo', false, 71),
('agents.update',               'agents',        'update',        'Editar agentes',                           true,  'Equipo', false, 72),
('agents.delete',               'agents',        'delete',        'Desactivar agentes',                       false, 'Equipo', true,  73),
('agents.view_metrics',         'agents',        'view_metrics',  'Ver métricas de agentes',                  true,  'Equipo', false, 74),
('teams.read',                  'teams',         'read',          'Ver equipos',                              false, 'Equipo', false, 75),
('teams.manage',                'teams',         'manage',        'Crear/editar equipos',                     false, 'Equipo', false, 76),

-- ─── REPORTS ───────────────────────────────────────────────
('reports.view',                'reports',       'view',          'Ver reportes y dashboard',                 true,  'Reportes', false, 80),
('reports.export',              'reports',       'export',        'Exportar reportes (PDF/Excel)',            true,  'Reportes', false, 81),
('reports.view_costs',          'reports',       'view_costs',    'Ver consumo de tokens/IA',                 false, 'Reportes', false, 82),

-- ─── AI / CLAUDE ───────────────────────────────────────────
('ai.configure',                'ai',            'configure',     'Editar system prompt y parámetros IA',     false, 'IA', false, 90),
('ai.view_costs',               'ai',            'view_costs',    'Ver consumo de tokens',                    false, 'IA', false, 91),
('ai.toggle',                   'ai',            'toggle',        'Activar/desactivar IA por conversación',   true,  'IA', false, 92),

-- ─── USERS / RBAC ──────────────────────────────────────────
('users.read',                  'users',         'read',          'Ver usuarios de la organización',          false, 'Usuarios y Permisos', false, 100),
('users.invite',                'users',         'invite',        'Invitar nuevos usuarios',                  false, 'Usuarios y Permisos', false, 101),
('users.create',                'users',         'create',        'Crear usuarios con contraseña temporal',   false, 'Usuarios y Permisos', false, 102),
('users.update',                'users',         'update',        'Editar perfiles de usuarios',              false, 'Usuarios y Permisos', false, 103),
('users.deactivate',            'users',         'deactivate',    'Desactivar usuarios',                      false, 'Usuarios y Permisos', true,  104),
('users.delete',                'users',         'delete',        'Eliminar usuarios',                        false, 'Usuarios y Permisos', true,  105),
('users.assign_roles',          'users',         'assign_roles',  'Asignar roles a otros usuarios',           false, 'Usuarios y Permisos', true,  106),
('roles.read',                  'roles',         'read',          'Ver roles y permisos',                     false, 'Usuarios y Permisos', false, 107),
('roles.create',                'roles',         'create',        'Crear roles personalizados',               false, 'Usuarios y Permisos', false, 108),
('roles.update',                'roles',         'update',        'Editar roles',                             false, 'Usuarios y Permisos', true,  109),
('roles.delete',                'roles',         'delete',        'Eliminar roles personalizados',            false, 'Usuarios y Permisos', true,  110),
('audit.read',                  'audit',         'read',          'Ver registros de auditoría',               false, 'Usuarios y Permisos', false, 111),

-- ─── SETTINGS / ORG ────────────────────────────────────────
('settings.read',               'settings',      'read',          'Ver configuración de la org',              false, 'Configuración', false, 120),
('settings.update',             'settings',      'update',        'Editar configuración de la org',           false, 'Configuración', false, 121),
('billing.view',                'billing',       'view',          'Ver facturación y plan',                   false, 'Facturación', false, 130),
('billing.manage',              'billing',       'manage',        'Gestionar plan y método de pago',          false, 'Facturación', true,  131),

-- ─── TAGS ──────────────────────────────────────────────────
('tags.manage',                 'tags',          'manage',        'Crear/editar etiquetas',                   false, 'Configuración', false, 122)
ON CONFLICT (key) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- ROLES DEL SISTEMA
-- organization_id = NULL → globales, disponibles en todas las orgs
-- ═══════════════════════════════════════════════════════════════
INSERT INTO roles (id, organization_id, key, name, description, color, icon, is_system, priority) VALUES
('aa000000-0000-0000-0000-000000000001', NULL, 'super_admin', 'Super Admin', 'Acceso total al sistema. No se puede restringir.', '#dc2626', '👑', true, 100),
('aa000000-0000-0000-0000-000000000002', NULL, 'admin',       'Administrador','Gestiona la organización (excepto facturación).',  '#7c3aed', '🛡️', true, 80),
('aa000000-0000-0000-0000-000000000003', NULL, 'supervisor',  'Supervisor',   'Gestiona su equipo, ve reportes del equipo.',       '#0891b2', '📊', true, 60),
('aa000000-0000-0000-0000-000000000004', NULL, 'agent',       'Agente',       'Atiende conversaciones asignadas.',                 '#059669', '💬', true, 40),
('aa000000-0000-0000-0000-000000000005', NULL, 'viewer',      'Solo Lectura', 'Ve dashboards y reportes; no interactúa.',          '#64748b', '👁️', true, 20)
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- ASIGNACIÓN DE PERMISOS A ROLES DEL SISTEMA
-- Super Admin: no se le asignan aquí, tiene wildcard (se resuelve en código)
-- ═══════════════════════════════════════════════════════════════

-- ─── ADMIN: todo excepto billing.manage, users.delete, settings.update crítico ──
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'aa000000-0000-0000-0000-000000000002'::uuid, p.id,
       CASE WHEN p.scopeable THEN 'all'::permission_scope ELSE 'all'::permission_scope END
FROM permissions p
WHERE p.key NOT IN (
  'billing.manage',
  'users.delete',
  'roles.delete'
)
ON CONFLICT DO NOTHING;

-- ─── SUPERVISOR ────────────────────────────────────────────
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'aa000000-0000-0000-0000-000000000003'::uuid, p.id,
       CASE
         WHEN p.scopeable AND p.key IN (
           'conversations.read', 'conversations.update', 'conversations.assign',
           'conversations.transfer', 'conversations.resolve', 'conversations.takeover',
           'conversations.export', 'agents.view_metrics', 'agents.read', 'agents.update',
           'reports.view', 'reports.export', 'notes.read', 'notes.create', 'ai.toggle',
           'messages.send', 'messages.send_media'
         ) THEN 'team'::permission_scope
         ELSE 'all'::permission_scope
       END
FROM permissions p
WHERE p.key IN (
  'conversations.read', 'conversations.update', 'conversations.assign',
  'conversations.transfer', 'conversations.resolve', 'conversations.takeover',
  'conversations.export', 'messages.send', 'messages.send_media',
  'notes.create', 'notes.read',
  'contacts.read', 'contacts.update', 'contacts.block',
  'agents.read', 'agents.update', 'agents.view_metrics',
  'teams.read', 'reports.view', 'reports.export',
  'ai.toggle', 'tags.manage'
)
ON CONFLICT DO NOTHING;

-- ─── AGENT ─────────────────────────────────────────────────
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'aa000000-0000-0000-0000-000000000004'::uuid, p.id,
       CASE
         WHEN p.scopeable AND p.key IN (
           'conversations.read', 'conversations.update', 'conversations.resolve',
           'messages.send', 'messages.send_media', 'notes.create', 'notes.read',
           'ai.toggle', 'agents.view_metrics'
         ) THEN 'own'::permission_scope
         ELSE 'all'::permission_scope
       END
FROM permissions p
WHERE p.key IN (
  'conversations.read', 'conversations.update', 'conversations.resolve',
  'messages.send', 'messages.send_media',
  'notes.create', 'notes.read',
  'contacts.read', 'contacts.update',
  'agents.read', 'agents.view_metrics',
  'ai.toggle'
)
ON CONFLICT DO NOTHING;

-- ─── VIEWER (solo lectura) ─────────────────────────────────
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT 'aa000000-0000-0000-0000-000000000005'::uuid, p.id, 'all'::permission_scope
FROM permissions p
WHERE p.key IN (
  'conversations.read', 'contacts.read', 'agents.read',
  'teams.read', 'reports.view', 'reports.view_costs',
  'channels.read', 'flows.read', 'knowledge.read', 'settings.read'
)
ON CONFLICT DO NOTHING;
