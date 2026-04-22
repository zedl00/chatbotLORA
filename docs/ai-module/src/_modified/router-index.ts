// Ruta: /src/router/index.ts
// ═══════════════════════════════════════════════════════════════
// MODIFICADO en Sprint 3 (AI):
//   - /admin/playground (probar el bot)
//   - /admin/ai-personas (configurar personalidades)
//   - /admin/ai-usage (reporte de consumo)
// ═══════════════════════════════════════════════════════════════
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { authGuard, roleGuard, permissionGuard, mustChangePasswordGuard } from './guards'

const routes: RouteRecordRaw[] = [
  // ── AUTH ────────────────────────────────────────────
  {
    path: '/auth',
    component: () => import('@/layouts/AuthLayout.vue'),
    children: [
      { path: 'login',           name: 'auth.login',           component: () => import('@/modules/auth/views/LoginView.vue'),            meta: { public: true } },
      { path: 'forgot-password', name: 'auth.forgot',          component: () => import('@/modules/auth/views/ForgotPasswordView.vue'),  meta: { public: true } },
      { path: 'accept-invite',   name: 'auth.accept-invite',   component: () => import('@/modules/auth/views/AcceptInviteView.vue'),    meta: { public: true } },
      { path: 'change-password', name: 'auth.change-password', component: () => import('@/modules/auth/views/ChangePasswordView.vue'),  meta: { requiresAuth: true } }
    ]
  },

  // ── ADMIN PANEL ─────────────────────────────────────
  {
    path: '/admin',
    component: () => import('@/layouts/AdminLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: { name: 'admin.dashboard' } },

      // Trabajo diario
      { path: 'dashboard',   name: 'admin.dashboard',   component: () => import('@/modules/reports/views/DashboardView.vue'),    meta: { permission: 'reports.view' } },
      { path: 'inbox',       name: 'admin.inbox',       component: () => import('@/modules/inbox/views/InboxView.vue'),          meta: { permission: 'conversations.read' } },
      { path: 'my-inbox',    name: 'admin.my-inbox',    component: () => import('@/modules/inbox/views/MyInboxView.vue'),        meta: { permission: 'conversations.read' } },
      { path: 'contacts',    name: 'admin.contacts',    component: () => import('@/modules/contacts/views/ContactsView.vue'),    meta: { permission: 'contacts.read' } },

      // Configuración del bot
      { path: 'flows',       name: 'admin.flows',       component: () => import('@/modules/flows/views/FlowsView.vue'),          meta: { permission: 'flows.read' } },
      { path: 'knowledge',   name: 'admin.knowledge',   component: () => import('@/modules/knowledge/views/KnowledgeView.vue'),  meta: { permission: 'knowledge.read' } },
      { path: 'channels',    name: 'admin.channels',    component: () => import('@/modules/channels/views/ChannelsView.vue'),    meta: { permission: 'channels.read' } },
      { path: 'agents',      name: 'admin.agents',      component: () => import('@/modules/agents/views/AgentsView.vue'),        meta: { permission: 'agents.read' } },
      { path: 'reports',     name: 'admin.reports',     component: () => import('@/modules/reports/views/ReportsView.vue'),      meta: { permission: 'reports.view' } },

      // IA
      { path: 'ai-personas', name: 'admin.ai-personas', component: () => import('@/modules/ai/views/AiPersonasView.vue'),        meta: { permission: 'ai.configure' } },
      { path: 'playground',  name: 'admin.playground',  component: () => import('@/modules/playground/views/PlaygroundView.vue'),meta: { permission: 'ai.configure' } },

      // Administración
      { path: 'users',       name: 'admin.users',       component: () => import('@/modules/agents/views/UsersView.vue'),         meta: { permission: 'users.read' } },
      { path: 'roles',       name: 'admin.roles',       component: () => import('@/modules/agents/views/RolesView.vue'),         meta: { permission: 'roles.read' } },
      { path: 'invitations', name: 'admin.invitations', component: () => import('@/modules/agents/views/InvitationsView.vue'),   meta: { permission: 'users.invite' } },
      { path: 'audit',       name: 'admin.audit',       component: () => import('@/modules/agents/views/AuditLogView.vue'),      meta: { permission: 'audit.read' } },
      { path: 'settings',    name: 'admin.settings',    component: () => import('@/modules/settings/views/SettingsView.vue'),    meta: { permission: 'settings.read' } }
    ]
  },

  { path: '/', redirect: { name: 'admin.dashboard' } },
  { path: '/:pathMatch(.*)*', redirect: { name: 'auth.login' } }
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach(authGuard)
router.beforeEach(mustChangePasswordGuard)
router.beforeEach(permissionGuard)
router.beforeEach(roleGuard)

export default router
