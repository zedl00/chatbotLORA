// Ruta: /src/router/index.ts
// ═══════════════════════════════════════════════════════════════
// MODIFICADO en RBAC sprint:
//   - Ruta pública /auth/accept-invite
//   - Nuevas rutas /admin/users, /admin/roles, /admin/invitations, /admin/audit
//   - Uso de meta.permission en vez de meta.roles (pero ambos compatibles)
//   - Guard de permisos granulares agregado
//   - Guard que fuerza el cambio de contraseña si must_change_password=true
// ═══════════════════════════════════════════════════════════════
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { authGuard, roleGuard, permissionGuard, mustChangePasswordGuard } from './guards'

const routes: RouteRecordRaw[] = [
  // ── AUTH ────────────────────────────────────────────
  {
    path: '/auth',
    component: () => import('@/layouts/AuthLayout.vue'),
    children: [
      {
        path: 'login',
        name: 'auth.login',
        component: () => import('@/modules/auth/views/LoginView.vue'),
        meta: { public: true }
      },
      {
        path: 'forgot-password',
        name: 'auth.forgot',
        component: () => import('@/modules/auth/views/ForgotPasswordView.vue'),
        meta: { public: true }
      },
      // 🆕 RBAC: aceptar invitación (público)
      {
        path: 'accept-invite',
        name: 'auth.accept-invite',
        component: () => import('@/modules/auth/views/AcceptInviteView.vue'),
        meta: { public: true }
      },
      // 🆕 RBAC: forzar cambio de contraseña
      {
        path: 'change-password',
        name: 'auth.change-password',
        component: () => import('@/modules/auth/views/ChangePasswordView.vue'),
        meta: { requiresAuth: true }
      }
    ]
  },

  // ── ADMIN PANEL ─────────────────────────────────────
  {
    path: '/admin',
    component: () => import('@/layouts/AdminLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: { name: 'admin.dashboard' } },
      {
        path: 'dashboard',
        name: 'admin.dashboard',
        component: () => import('@/modules/reports/views/DashboardView.vue'),
        meta: { permission: 'reports.view' }
      },
      {
        path: 'inbox',
        name: 'admin.inbox',
        component: () => import('@/modules/inbox/views/InboxView.vue'),
        meta: { permission: 'conversations.read' }
      },
      {
        path: 'my-inbox',
        name: 'admin.my-inbox',
        component: () => import('@/modules/inbox/views/MyInboxView.vue'),
        meta: { permission: 'conversations.read' }
      },
      {
        path: 'contacts',
        name: 'admin.contacts',
        component: () => import('@/modules/contacts/views/ContactsView.vue'),
        meta: { permission: 'contacts.read' }
      },
      {
        path: 'flows',
        name: 'admin.flows',
        component: () => import('@/modules/flows/views/FlowsView.vue'),
        meta: { permission: 'flows.read' }
      },
      {
        path: 'knowledge',
        name: 'admin.knowledge',
        component: () => import('@/modules/knowledge/views/KnowledgeView.vue'),
        meta: { permission: 'knowledge.read' }
      },
      {
        path: 'channels',
        name: 'admin.channels',
        component: () => import('@/modules/channels/views/ChannelsView.vue'),
        meta: { permission: 'channels.read' }
      },
      {
        path: 'agents',
        name: 'admin.agents',
        component: () => import('@/modules/agents/views/AgentsView.vue'),
        meta: { permission: 'agents.read' }
      },
      {
        path: 'reports',
        name: 'admin.reports',
        component: () => import('@/modules/reports/views/ReportsView.vue'),
        meta: { permission: 'reports.view' }
      },
      {
        path: 'settings',
        name: 'admin.settings',
        component: () => import('@/modules/settings/views/SettingsView.vue'),
        meta: { permission: 'settings.read' }
      },
      // 🆕 RBAC: gestión de usuarios, roles e invitaciones
      {
        path: 'users',
        name: 'admin.users',
        component: () => import('@/modules/agents/views/UsersView.vue'),
        meta: { permission: 'users.read' }
      },
      {
        path: 'roles',
        name: 'admin.roles',
        component: () => import('@/modules/agents/views/RolesView.vue'),
        meta: { permission: 'roles.read' }
      },
      {
        path: 'invitations',
        name: 'admin.invitations',
        component: () => import('@/modules/agents/views/InvitationsView.vue'),
        meta: { permission: 'users.invite' }
      },
      {
        path: 'audit',
        name: 'admin.audit',
        component: () => import('@/modules/agents/views/AuditLogView.vue'),
        meta: { permission: 'audit.read' }
      }
    ]
  },

  // ── FALLBACK ────────────────────────────────────────
  { path: '/', redirect: { name: 'admin.dashboard' } },
  { path: '/:pathMatch(.*)*', redirect: { name: 'auth.login' } }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Orden importa: auth → change password → permisos → roles (legacy)
router.beforeEach(authGuard)
router.beforeEach(mustChangePasswordGuard)
router.beforeEach(permissionGuard)
router.beforeEach(roleGuard)

export default router
