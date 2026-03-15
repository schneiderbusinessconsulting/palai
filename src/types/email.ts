export interface EmailDraft {
  id: string
  ai_generated_response: string
  edited_response?: string
  confidence_score: number
  status: string
  formality?: 'sie' | 'du'
}

export interface Email {
  id: string
  hubspot_email_id: string
  from_email: string
  from_name?: string
  subject: string
  body_text: string
  body_html?: string
  received_at: string
  status: string
  email_type?: 'customer_inquiry' | 'form_submission' | 'system_alert' | 'notification'
  needs_response?: boolean
  classification_reason?: string
  buying_intent_score?: number
  happiness_score?: number
  email_drafts?: EmailDraft[]
  assigned_agent_id?: string
  support_level?: string
  snoozed_until?: string
  tags?: string[]
  hubspot_thread_id?: string
  is_spam?: boolean
  spam_score?: number
  topic_tags?: string[]
  is_muted?: boolean
  star_type?: string
}

export interface EmailNote {
  id: string
  email_id: string
  agent_name: string
  content: string
  created_at: string
}

export interface Agent {
  id: string
  name: string
  email: string
  role: string
  specializations?: string[]
  is_active: boolean
}

export interface SavedView {
  id: string
  name: string
  filters: {
    status: string
    hideSent: boolean
    hideSystemMails: boolean
    searchQuery: string
    assignedAgentId: string
  }
}
