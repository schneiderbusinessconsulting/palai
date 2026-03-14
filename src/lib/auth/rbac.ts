/**
 * Role-Based Access Control utility.
 * Works with existing support_agents table roles: 'admin', 'L1', 'L2'.
 */

export type AgentRole = 'admin' | 'L1' | 'L2'

export interface Agent {
  id: string
  name: string
  email: string
  role: AgentRole
  is_active: boolean
}

const ROLE_HIERARCHY: Record<AgentRole, number> = {
  admin: 3,
  L2: 2,
  L1: 1,
}

/**
 * Check if an agent has at least the required role level.
 * admin > L2 > L1
 */
export function hasRole(agentRole: AgentRole, requiredRole: AgentRole): boolean {
  return (ROLE_HIERARCHY[agentRole] || 0) >= (ROLE_HIERARCHY[requiredRole] || 0)
}

/**
 * Check if the agent is an admin.
 */
export function isAdmin(agent: Agent): boolean {
  return agent.role === 'admin'
}

/**
 * Check if the agent can manage the given resource.
 * Admins can manage everything.
 * L2 agents can manage L1 resources.
 * Agents can always manage their own resources.
 */
export function canManage(agent: Agent, resourceOwnerId?: string): boolean {
  if (agent.role === 'admin') return true
  if (resourceOwnerId === agent.id) return true
  return false
}

/**
 * Check if the agent can view an email.
 * Admins see all. Agents see unassigned + their own assigned emails.
 */
export function canViewEmail(
  agent: Agent,
  emailAssignedTo?: string | null
): boolean {
  if (agent.role === 'admin') return true
  if (!emailAssignedTo) return true  // unassigned = visible to all
  return emailAssignedTo === agent.id
}

/**
 * Available permissions for UI feature gating.
 */
export const PERMISSIONS = {
  MANAGE_AGENTS: 'admin',
  MANAGE_AUTOMATION: 'admin',
  MANAGE_SLA: 'admin',
  VIEW_AUDIT_TRAIL: 'admin',
  MANAGE_TEMPLATES: 'L1',
  ASSIGN_EMAILS: 'L1',
  VIEW_INSIGHTS: 'L1',
} as const

export function hasPermission(
  agentRole: AgentRole,
  permission: keyof typeof PERMISSIONS
): boolean {
  const requiredRole = PERMISSIONS[permission] as AgentRole
  return hasRole(agentRole, requiredRole)
}
