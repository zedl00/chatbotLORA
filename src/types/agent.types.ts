// Ruta: /src/types/agent.types.ts

export type AgentStatus = 'online' | 'busy' | 'away' | 'offline'

export interface Agent {
  id: string
  userId: string
  organizationId: string
  teamId: string | null
  status: AgentStatus
  statusMessage: string | null
  maxConcurrentChats: number
  autoAssign: boolean
  skills: string[]
  workingHours: Record<string, unknown>
  slaTier: string
  statusChangedAt: string
  createdAt: string
  updatedAt: string
}

export interface AgentWithUser extends Agent {
  user: {
    id: string
    fullName: string | null
    email: string
    avatarUrl: string | null
    role: import('./user.types').UserRole
  }
}

export interface Team {
  id: string
  organizationId: string
  name: string
  description: string | null
  supervisorId: string | null
  color: string
  active: boolean
  createdAt: string
  updatedAt: string
}
