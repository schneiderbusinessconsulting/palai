import { describe, it, expect } from 'vitest'
import { hasRole, isAdmin, canManage, canViewEmail, hasPermission, Agent } from '../rbac'

const adminAgent: Agent = { id: 'a1', name: 'Admin', email: 'admin@test.com', role: 'admin', is_active: true }
const l2Agent: Agent = { id: 'a2', name: 'L2 Agent', email: 'l2@test.com', role: 'L2', is_active: true }
const l1Agent: Agent = { id: 'a3', name: 'L1 Agent', email: 'l1@test.com', role: 'L1', is_active: true }

describe('hasRole', () => {
  it('admin has all roles', () => {
    expect(hasRole('admin', 'admin')).toBe(true)
    expect(hasRole('admin', 'L2')).toBe(true)
    expect(hasRole('admin', 'L1')).toBe(true)
  })

  it('L2 has L2 and L1 roles', () => {
    expect(hasRole('L2', 'admin')).toBe(false)
    expect(hasRole('L2', 'L2')).toBe(true)
    expect(hasRole('L2', 'L1')).toBe(true)
  })

  it('L1 only has L1 role', () => {
    expect(hasRole('L1', 'admin')).toBe(false)
    expect(hasRole('L1', 'L2')).toBe(false)
    expect(hasRole('L1', 'L1')).toBe(true)
  })
})

describe('isAdmin', () => {
  it('identifies admin correctly', () => {
    expect(isAdmin(adminAgent)).toBe(true)
    expect(isAdmin(l2Agent)).toBe(false)
    expect(isAdmin(l1Agent)).toBe(false)
  })
})

describe('canManage', () => {
  it('admin can manage anything', () => {
    expect(canManage(adminAgent, 'other-id')).toBe(true)
  })

  it('agent can manage own resources', () => {
    expect(canManage(l1Agent, l1Agent.id)).toBe(true)
  })

  it('agent cannot manage others resources', () => {
    expect(canManage(l1Agent, 'other-id')).toBe(false)
  })
})

describe('canViewEmail', () => {
  it('admin can view all emails', () => {
    expect(canViewEmail(adminAgent, 'other-agent')).toBe(true)
  })

  it('agent can view unassigned emails', () => {
    expect(canViewEmail(l1Agent, null)).toBe(true)
    expect(canViewEmail(l1Agent, undefined)).toBe(true)
  })

  it('agent can view own assigned emails', () => {
    expect(canViewEmail(l1Agent, l1Agent.id)).toBe(true)
  })

  it('agent cannot view others assigned emails', () => {
    expect(canViewEmail(l1Agent, 'other-agent')).toBe(false)
  })
})

describe('hasPermission', () => {
  it('admin has all permissions', () => {
    expect(hasPermission('admin', 'MANAGE_AGENTS')).toBe(true)
    expect(hasPermission('admin', 'MANAGE_AUTOMATION')).toBe(true)
    expect(hasPermission('admin', 'VIEW_AUDIT_TRAIL')).toBe(true)
    expect(hasPermission('admin', 'ASSIGN_EMAILS')).toBe(true)
  })

  it('L1 has L1 permissions but not admin', () => {
    expect(hasPermission('L1', 'ASSIGN_EMAILS')).toBe(true)
    expect(hasPermission('L1', 'VIEW_INSIGHTS')).toBe(true)
    expect(hasPermission('L1', 'MANAGE_AGENTS')).toBe(false)
    expect(hasPermission('L1', 'MANAGE_AUTOMATION')).toBe(false)
  })

  it('L2 has L1 permissions but not admin', () => {
    expect(hasPermission('L2', 'ASSIGN_EMAILS')).toBe(true)
    expect(hasPermission('L2', 'MANAGE_AGENTS')).toBe(false)
  })
})
