// Ruta: /src/router/index.ts
// ═══════════════════════════════════════════════════════════════
// MODIFICADO en Sprint 5 (Multi-tenant):
//   - Nueva sección de rutas /super-admin/* con superAdminGuard
//   - Nueva vista: /super-admin/organizations
//   - Guard orgContextGuard agregado a la cadena
//
// MODIFICADO en Sprint 7 (Editor de branding):
//   - Nueva ruta /admin/branding (editor per-tenant de color, logo, mensajes)
// ═══════════════════════════════════════════════════════════════
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import {
  authGuard,
  roleGuard,
  permissionGuard,
  mustChangePasswordGuard,
  orgContextGuard,
  superAdminGuard
} from './guards'

const routes: RouteRecordRaw[] = [
  // AUTH
  {
    path: '/auth',
    component: () => import('@/layouts/AuthLayout.vue'),
    children: [
      { path: 'login',           name: 'auth.login',           component: () => import('@/modules/auth/views/LoginView.vue'),            meta: { public: true, title: 'Iniciar sesión' } },
      { path: 'forgot-password', name: 'auth.forgot',          component: () => import('@/modules/auth/views/ForgotPasswordView.vue'),  meta: { public: true, title: 'Recuperar contraseña' } },
      { path: 'accept-invite',   name: 'auth.accept-invite',   component: () => import('@/modules/auth/views/AcceptInviteView.vue'),    meta: { public: true, title: 'Aceptar invitación' } },
      { path: 'change-password', name: 'auth.change-password', component: () => import('@/modules/auth/views/ChangePasswordView.vue'),  meta: { requiresAuth: true, title: 'Cambiar contraseña' } }
    ]
  },

  // ADMIN
  {
    path: '/admin',
    component: () => import('@/layouts/AdminLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: { name: 'admin.dashboard' } },

      { path: 'dashboard',   name: 'admin.dashboard',   component: () => import('@/modules/reports/views/DashboardView.vue'),    meta: { permission: 'reports.view', title: 'Dashboard' } },
      { path: 'inbox',       name: 'admin.inbox',       component: () => import('@/modules/inbox/views/InboxView.vue'),          meta: { permission: 'conversations.read', title: 'Bandeja' } },
      { path: 'contacts',    name: 'admin.contacts',    component: () => import('@/modules/contacts/views/ContactsView.vue'),    meta: { permission: 'contacts.read', title: 'Contactos' } },

      { path: 'flows',       name: 'admin.flows',       component: () => import('@/modules/flows/views/FlowsView.vue'),          meta: { permission: 'flows.read', title: 'Flujos' } },
      { path: 'knowledge',   name: 'admin.knowledge',   component: () => import('@/modules/knowledge/views/KnowledgeView.vue'),  meta: { permission: 'knowledge.read', title: 'Conocimiento' } },
      { path: 'channels',    name: 'admin.channels',    component: () => import('@/modules/channels/views/ChannelsView.vue'),    meta: { permission: 'channels.read', title: 'Canales' } },
      { path: 'agents',      name: 'admin.agents',      component: () => import('@/modules/agents/views/AgentsView.vue'),        meta: { permission: 'agents.read', title: 'Equipo' } },
      { path: 'reports',     name: 'admin.reports',     component: () => import('@/modules/reports/views/ReportsView.vue'),      meta: { permission: 'reports.view', title: 'Reportes' } },

      // 🆕 Sprint 7: Editor de branding per-tenant (color, logo, mensajes del widget)
      { path: 'branding',    name: 'admin.branding',    component: () => import('@/modules/settings/views/BrandingView.vue'),    meta: { permission: 'settings.update', title: 'Branding' } },

      // IA
      { path: 'ai-personas', name: 'admin.ai-personas', component: () => import('@/modules/ai/views/AiPersonasView.vue'),        meta: { permission: 'ai.configure', title: 'Personalidades IA' } },
      { path: 'playground',  name: 'admin.playground',  component: () => import('@/modules/playground/views/PlaygroundView.vue'),meta: { permission: 'ai.configure', title: 'Playground' } },

      // Administración
      { path: 'users',       name: 'admin.users',       component: () => import('@/modules/agents/views/UsersView.vue'),         meta: { permission: 'users.read', title: 'Usuarios' } },
      { path: 'roles',       name: 'admin.roles',       component: () => import('@/modules/agents/views/RolesView.vue'),         meta: { permission: 'roles.read', title: 'Roles' } },
      { path: 'invitations', name: 'admin.invitations', component: () => import('@/modules/agents/views/InvitationsView.vue'),   meta: { permission: 'users.invite', title: 'Invitaciones' } },
      { path: 'audit',       name: 'admin.audit',       component: () => import('@/modules/agents/views/AuditLogView.vue'),      meta: { permission: 'audit.read', title: 'Auditoría' } },
      { path: 'settings',    name: 'admin.settings',    component: () => import('@/modules/settings/views/SettingsView.vue'),    meta: { permission: 'settings.read', title: 'Configuración' } }
    ]
  },

  // SUPER ADMIN — solo accesible para role 'super_admin'
  {
    path: '/super-admin',
    component: () => import('@/layouts/AdminLayout.vue'),
    meta: { requiresAuth: true, superAdmin: true },
    children: [
      { path: '', redirect: { name: 'super-admin.organizations' } },
      {
        path: 'organizations',
        name: 'super-admin.organizations',
        component: () => import('@/modules/super-admin/views/OrganizationsView.vue'),
        meta: { title: 'Organizaciones', superAdmin: true }
      }
    ]
  },

  { path: '/', redirect: { name: 'admin.dashboard' } },
  { path: '/:pathMatch(.*)*', redirect: { name: 'auth.login' } }
]

const router = createRouter({ history: createWebHistory(), routes })

// ═══ Orden de guards (importante) ═══
// 1. authGuard: verifica sesión
// 2. mustChangePasswordGuard: fuerza cambio de contraseña si aplica
// 3. orgContextGuard: valida contexto de tenant (subdomain)
// 4. permissionGuard: verifica permisos granulares
// 5. roleGuard: legacy, solo si meta.roles está presente
// 6. Guard inline: valida meta.superAdmin = true
router.beforeEach(authGuard)
router.beforeEach(mustChangePasswordGuard)
router.beforeEach(orgContextGuard)
router.beforeEach(permissionGuard)
router.beforeEach(roleGuard)
router.beforeEach((to) => {
  if (to.meta.superAdmin === true) {
    return superAdminGuard(to, to, () => {}) as any
  }
  return true
})

export default router
