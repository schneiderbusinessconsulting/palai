import { SupabaseClient } from '@supabase/supabase-js'

export interface AutomationCondition {
  field: string
  operator: 'eq' | 'neq' | 'contains' | 'not_contains' | 'in' | 'gt' | 'lt' | 'gte' | 'lte'
  value: string | number | string[]
}

export interface AutomationAction {
  type: 'assign_agent' | 'add_tag' | 'set_priority' | 'set_status' | 'escalate'
  value: string | Record<string, string>
}

export interface AutomationRule {
  id: string
  name: string
  description?: string
  trigger: 'email_received' | 'sla_at_risk' | 'sla_breached' | 'tag_added'
  conditions: AutomationCondition[]
  actions: AutomationAction[]
  is_active: boolean
  priority: number
  run_count: number
}

interface EmailData {
  id: string
  from_email?: string
  from_name?: string
  subject?: string
  priority?: string
  tone_sentiment?: string
  buying_intent_score?: number
  email_type?: string
  tags?: string[]
  support_level?: string
  [key: string]: unknown
}

export function evaluateConditions(email: EmailData, conditions: AutomationCondition[]): boolean {
  return conditions.every(condition => {
    const fieldValue = email[condition.field]

    switch (condition.operator) {
      case 'eq':
        return fieldValue === condition.value
      case 'neq':
        return fieldValue !== condition.value
      case 'contains':
        if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
          return fieldValue.toLowerCase().includes(condition.value.toLowerCase())
        }
        if (Array.isArray(fieldValue) && typeof condition.value === 'string') {
          return fieldValue.includes(condition.value)
        }
        return false
      case 'not_contains':
        if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
          return !fieldValue.toLowerCase().includes(condition.value.toLowerCase())
        }
        return true
      case 'in':
        if (Array.isArray(condition.value)) {
          return condition.value.includes(String(fieldValue))
        }
        return false
      case 'gt':
        return typeof fieldValue === 'number' && fieldValue > Number(condition.value)
      case 'lt':
        return typeof fieldValue === 'number' && fieldValue < Number(condition.value)
      case 'gte':
        return typeof fieldValue === 'number' && fieldValue >= Number(condition.value)
      case 'lte':
        return typeof fieldValue === 'number' && fieldValue <= Number(condition.value)
      default:
        return false
    }
  })
}

export async function executeActions(
  supabase: SupabaseClient,
  emailId: string,
  actions: AutomationAction[]
): Promise<void> {
  for (const action of actions) {
    switch (action.type) {
      case 'assign_agent':
        await supabase
          .from('incoming_emails')
          .update({ assigned_agent_id: action.value })
          .eq('id', emailId)
        break

      case 'set_priority':
        await supabase
          .from('incoming_emails')
          .update({ priority: action.value })
          .eq('id', emailId)
        break

      case 'set_status':
        await supabase
          .from('incoming_emails')
          .update({ status: action.value })
          .eq('id', emailId)
        break

      case 'escalate': {
        const escalateValue = action.value as Record<string, string>
        const toLevel = escalateValue?.to_level || 'L2'
        await supabase
          .from('incoming_emails')
          .update({ support_level: toLevel })
          .eq('id', emailId)
        // Try to insert into ticket_escalations (may not exist)
        try {
          await supabase.from('ticket_escalations').insert({
            email_id: emailId,
            escalated_to_level: toLevel,
            reason: 'automation_rule',
          })
        } catch { /* table may not exist */ }
        break
      }

      case 'add_tag':
        // Tags stored as text[] — append if not already present
        // Use raw SQL via RPC or just fetch-update pattern
        try {
          const { data: email } = await supabase
            .from('incoming_emails')
            .select('tags')
            .eq('id', emailId)
            .single()
          const currentTags: string[] = email?.tags || []
          const tag = String(action.value)
          if (!currentTags.includes(tag)) {
            await supabase
              .from('incoming_emails')
              .update({ tags: [...currentTags, tag] })
              .eq('id', emailId)
          }
        } catch { /* tags column may not exist */ }
        break
    }
  }
}

export async function runAutomationRules(
  supabase: SupabaseClient,
  email: EmailData,
  trigger: string
): Promise<{ rulesMatched: number; actionsExecuted: number }> {
  let rulesMatched = 0
  let actionsExecuted = 0

  try {
    // Try to fetch rules from automation_rules table
    const { data: rules, error } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('trigger', trigger)
      .eq('is_active', true)
      .order('priority', { ascending: true })

    if (error) {
      // Table may not exist — check for error code 42P01
      if (error.code === '42P01') return { rulesMatched: 0, actionsExecuted: 0 }
      throw error
    }

    if (!rules?.length) return { rulesMatched: 0, actionsExecuted: 0 }

    for (const rule of rules) {
      const conditions = (rule.conditions || []) as AutomationCondition[]
      const actions = (rule.actions || []) as AutomationAction[]

      if (evaluateConditions(email, conditions)) {
        rulesMatched++
        await executeActions(supabase, email.id, actions)
        actionsExecuted += actions.length

        // Increment run count
        await supabase
          .from('automation_rules')
          .update({ run_count: (rule.run_count || 0) + 1 })
          .eq('id', rule.id)
      }
    }
  } catch (err) {
    console.error('Automation rules error:', err)
  }

  return { rulesMatched, actionsExecuted }
}
