// Ruta: /src/types/rbac.types.ts
// ═══════════════════════════════════════════════════════════════
// Tipos del sistema RBAC granular.
// ═══════════════════════════════════════════════════════════════

export type PermissionScope = 'own' | 'team' | 'all'

export type PermissionKey = string  // ej: "conversations.assign"

export type PermissionCategory =
  | 'Conversaciones'
  | 'Mensajes'
  | 'Notas'
  | 'Contactos'
  | 'Canales'
  | 'Flujos IA'
  | 'Base de Conocimiento'
  | 'Equipo'
  | 'Reportes'
  | 'IA'
  | 'Usuarios y Permisos'
  | 'Configuración'
  | 'Facturación'

export interface Permission {
  id: string
  key: PermissionKey
  resource: string
  action: string
  description: string | null
  scopeable: boolean
  category: PermissionCategory
  isDangerous: boolean
  sortOrder: number
  createdAt: string
}

export interface Role {
  id: string
  organizationId: string | null   // null = role del sistema
  key: string
  name: string
  description: string | null
  color: string
  icon: string | null
  isSystem: boolean
  priority: number
  active: boolean
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface RolePermission {
  id: string
  roleId: string
  permissionId: string
  scope: PermissionScope
  createdAt: string
}

export interface RoleWithPermissions extends Role {
  permissions: Array<{
    permission: Permission
    scope: PermissionScope
  }>
}

export interface UserRole {
  id: string
  userId: string
  roleId: string
  organizationId: string
  expiresAt: string | null
  teamId: string | null
  grantedBy: string | null
  grantedReason: string | null
  createdAt: string
}

export interface UserPermission {
  id: string
  userId: string
  permissionId: string
  organizationId: string
  scope: PermissionScope
  grant: boolean            // true = conceder, false = denegar
  expiresAt: string | null
  grantedBy: string | null
  grantedReason: string | null
  createdAt: string
}

export interface EffectivePermission {
  permissionKey: PermissionKey
  scope: PermissionScope
  source: string   // "role:admin" | "direct"
}

// ═══════════════════════════════════════════════════════════════
// Invitaciones
// ═══════════════════════════════════════════════════════════════
export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired'

export interface Invitation {
  id: string
  organizationId: string
  email: string
  token: string
  roleId: string
  teamId: string | null
  status: InvitationStatus
  invitedBy: string | null
  acceptedAt: string | null
  acceptedBy: string | null
  revokedAt: string | null
  message: string | null
  expiresAt: string
  createdAt: string
}

export interface InvitationWithRole extends Invitation {
  role: Pick<Role, 'id' | 'name' | 'color' | 'icon'>
  inviter: { fullName: string | null; email: string } | null
}

// ═══════════════════════════════════════════════════════════════
// Auditoría
// ═══════════════════════════════════════════════════════════════
export interface PermissionAuditEntry {
  id: string
  organizationId: string
  actorId: string | null
  actorEmail: string | null
  targetUserId: string | null
  targetEmail: string | null
  action: string
  entityType: string | null
  entityId: string | null
  entityName: string | null
  beforeState: Record<string, unknown> | null
  afterState: Record<string, unknown> | null
  reason: string | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
}

// ═══════════════════════════════════════════════════════════════
// Helpers en tiempo de compilación — conjunto de permisos conocidos
// para autocomplete en IDE. No es exhaustivo ni obligatorio.
// ═══════════════════════════════════════════════════════════════
export const KNOWN_PERMISSIONS = {
  // Conversations
  ConversationsRead:       'conversations.read',
  ConversationsCreate:     'conversations.create',
  ConversationsUpdate:     'conversations.update',
  ConversationsAssign:     'conversations.assign',
  ConversationsTransfer:   'conversations.transfer',
  ConversationsResolve:    'conversations.resolve',
  ConversationsDelete:     'conversations.delete',
  ConversationsTakeover:   'conversations.takeover',
  ConversationsExport:     'conversations.export',
  // Messages
  MessagesSend:            'messages.send',
  MessagesSendMedia:       'messages.send_media',
  MessagesDelete:          'messages.delete',
  // Notes
  NotesCreate:             'notes.create',
  NotesRead:               'notes.read',
  NotesDelete:             'notes.delete',
  // Contacts
  ContactsRead:            'contacts.read',
  ContactsCreate:          'contacts.create',
  ContactsUpdate:          'contacts.update',
  ContactsDelete:          'contacts.delete',
  ContactsExport:          'contacts.export',
  ContactsBlock:           'contacts.block',
  // Channels
  ChannelsRead:            'channels.read',
  ChannelsCreate:          'channels.create',
  ChannelsUpdate:          'channels.update',
  ChannelsDelete:          'channels.delete',
  ChannelsViewCredentials: 'channels.view_credentials',
  // Flows
  FlowsRead:               'flows.read',
  FlowsCreate:             'flows.create',
  FlowsUpdate:             'flows.update',
  FlowsPublish:            'flows.publish',
  FlowsDelete:             'flows.delete',
  // Knowledge
  KnowledgeRead:           'knowledge.read',
  KnowledgeCreate:         'knowledge.create',
  KnowledgeUpdate:         'knowledge.update',
  KnowledgeDelete:         'knowledge.delete',
  // Agents & Teams
  AgentsRead:              'agents.read',
  AgentsCreate:            'agents.create',
  AgentsUpdate:            'agents.update',
  AgentsDelete:            'agents.delete',
  AgentsViewMetrics:       'agents.view_metrics',
  TeamsRead:               'teams.read',
  TeamsManage:             'teams.manage',
  // Reports
  ReportsView:             'reports.view',
  ReportsExport:           'reports.export',
  ReportsViewCosts:        'reports.view_costs',
  // AI
  AiConfigure:             'ai.configure',
  AiViewCosts:             'ai.view_costs',
  AiToggle:                'ai.toggle',
  // Users & RBAC
  UsersRead:               'users.read',
  UsersInvite:             'users.invite',
  UsersCreate:             'users.create',
  UsersUpdate:             'users.update',
  UsersDeactivate:         'users.deactivate',
  UsersDelete:             'users.delete',
  UsersAssignRoles:        'users.assign_roles',
  RolesRead:               'roles.read',
  RolesCreate:             'roles.create',
  RolesUpdate:             'roles.update',
  RolesDelete:             'roles.delete',
  AuditRead:               'audit.read',
  // Settings
  SettingsRead:            'settings.read',
  SettingsUpdate:          'settings.update',
  BillingView:             'billing.view',
  BillingManage:           'billing.manage',
  TagsManage:              'tags.manage'
} as const

export type KnownPermission = typeof KNOWN_PERMISSIONS[keyof typeof KNOWN_PERMISSIONS]
