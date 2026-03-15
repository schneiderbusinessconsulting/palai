import { Resend } from 'resend'

const HUBSPOT_API_BASE = 'https://api.hubapi.com'

// Lazy init Resend to avoid build errors
let resendClient: Resend | null = null
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY)
  }
  return resendClient
}

interface HubSpotEmail {
  id: string
  properties: {
    hs_email_subject?: string
    hs_email_text?: string
    hs_email_html?: string
    hs_email_from_email?: string
    hs_email_from_firstname?: string
    hs_email_from_lastname?: string
    hs_timestamp?: string
    hs_email_thread_id?: string
  }
}

interface HubSpotContact {
  id: string
  properties: {
    email?: string
    firstname?: string
    lastname?: string
  }
}

interface HubSpotOwner {
  id: string
  email: string
  firstName: string
  lastName: string
}

class HubSpotClient {
  private accessToken: string

  constructor() {
    const token = process.env.HUBSPOT_ACCESS_TOKEN
    if (!token) {
      throw new Error('HUBSPOT_ACCESS_TOKEN is not set')
    }
    this.accessToken = token
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${HUBSPOT_API_BASE}${endpoint}`
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`HubSpot API error: ${response.status} - ${error}`)
    }

    return response.json()
  }

  // Get recent emails from conversations
  async getRecentEmails(limit = 20): Promise<HubSpotEmail[]> {
    const response = await this.request<{ results: HubSpotEmail[] }>(
      `/crm/v3/objects/emails?limit=${limit}&properties=hs_email_subject,hs_email_text,hs_email_html,hs_email_from_email,hs_email_from_firstname,hs_email_from_lastname,hs_timestamp,hs_email_thread_id`
    )
    return response.results
  }

  // Get a specific email
  async getEmail(emailId: string): Promise<HubSpotEmail> {
    return this.request<HubSpotEmail>(
      `/crm/v3/objects/emails/${emailId}?properties=hs_email_subject,hs_email_text,hs_email_html,hs_email_from_email,hs_email_from_firstname,hs_email_from_lastname,hs_timestamp,hs_email_thread_id`
    )
  }

  // Get contact by email
  async getContactByEmail(email: string): Promise<HubSpotContact | null> {
    try {
      const response = await this.request<{ results: HubSpotContact[] }>(
        `/crm/v3/objects/contacts/search`,
        {
          method: 'POST',
          body: JSON.stringify({
            filterGroups: [
              {
                filters: [
                  {
                    propertyName: 'email',
                    operator: 'EQ',
                    value: email,
                  },
                ],
              },
            ],
            properties: ['email', 'firstname', 'lastname'],
          }),
        }
      )
      return response.results[0] || null
    } catch {
      return null
    }
  }

  // Send email reply via Resend + log to HubSpot
  async sendEmail(params: {
    to: string
    subject: string
    body: string
    threadId?: string
    contactId?: string
    fromEmail?: string
    fromName?: string
  }): Promise<{ id: string; actualSent: boolean }> {
    const fromEmail = params.fromEmail || process.env.RESEND_FROM_EMAIL || 'info@palacios-relations.ch'
    const fromName = params.fromName || 'Palacios Institut'

    // First, find contact by email
    let contactId = params.contactId
    if (!contactId) {
      const contact = await this.getContactByEmail(params.to)
      contactId = contact?.id
    }

    let actualSent = false
    let emailId = ''

    // Try to send via Resend if configured
    const resend = getResend()
    if (resend) {
      try {
        const { data, error } = await resend.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to: [params.to],
          subject: params.subject,
          text: params.body,
          html: params.body.replace(/\n/g, '<br>'),
        })

        if (error) {
          console.error('Resend error:', error)
        } else {
          actualSent = true
          emailId = data?.id || ''
          console.log('Email sent via Resend:', emailId)
        }
      } catch (e) {
        console.error('Resend send error:', e)
      }
    } else {
      console.log('Resend not configured - email will only be logged to HubSpot')
    }

    // Log reply to HubSpot using v3 CRM email API (supports thread_id for proper threading)
    const v3Id = await this.createReplyEngagementV3({
      to: params.to,
      subject: params.subject,
      body: params.body,
      threadId: params.threadId,
      contactId,
      fromEmail,
      status: actualSent ? 'SENT' : 'DRAFT',
    })
    emailId = emailId || v3Id

    // Fallback: also log via v1 engagements API for backwards compat
    if (!emailId) {
      try {
        const engagementData = {
          engagement: { active: true, type: 'EMAIL', timestamp: Date.now() },
          metadata: {
            from: { email: fromEmail },
            to: [{ email: params.to }],
            subject: params.subject,
            text: params.body,
            status: actualSent ? 'SENT' : 'DRAFT',
          },
          associations: {
            contactIds: contactId ? [parseInt(contactId)] : [],
            companyIds: [],
            dealIds: [],
            ownerIds: [],
            ticketIds: [],
          },
        }
        const response = await this.request<{ engagement: { id: number } }>(
          '/engagements/v1/engagements',
          { method: 'POST', body: JSON.stringify(engagementData) }
        )
        emailId = String(response.engagement.id)
      } catch (e) {
        console.error('Failed to log email to HubSpot v1:', e)
      }
    }

    return { id: emailId, actualSent }
  }

  // Save draft to HubSpot only (no actual sending)
  async saveDraftToHubSpot(params: {
    to: string
    subject: string
    body: string
  }): Promise<{ id: string; actualSent: boolean }> {
    // Find contact by email
    const contact = await this.getContactByEmail(params.to)
    const contactId = contact?.id

    // Create email engagement as DRAFT
    const engagementData = {
      engagement: {
        active: true,
        type: 'EMAIL',
        timestamp: Date.now(),
      },
      metadata: {
        from: { email: process.env.RESEND_FROM_EMAIL || 'info@palacios-relations.ch' },
        to: [{ email: params.to }],
        subject: params.subject,
        text: params.body,
        status: 'DRAFT',
      },
      associations: {
        contactIds: contactId ? [parseInt(contactId)] : [],
        companyIds: [],
        dealIds: [],
        ownerIds: [],
        ticketIds: [],
      },
    }

    const response = await this.request<{ engagement: { id: number } }>(
      '/engagements/v1/engagements',
      {
        method: 'POST',
        body: JSON.stringify(engagementData),
      }
    )

    return {
      id: String(response.engagement.id),
      actualSent: false,
    }
  }

  // Get knowledge base articles (if available)
  async getKnowledgeArticles(): Promise<unknown[]> {
    try {
      const response = await this.request<{ results: unknown[] }>(
        '/cms/v3/objects/knowledge_articles?limit=100'
      )
      return response.results
    } catch {
      console.log('Knowledge base not available or no access')
      return []
    }
  }

  // Get all HubSpot owners (team members)
  async getOwners(): Promise<HubSpotOwner[]> {
    try {
      const response = await this.request<{ results: HubSpotOwner[] }>(
        '/crm/v3/owners?limit=100'
      )
      return response.results
    } catch (e) {
      console.error('Failed to get owners:', e)
      return []
    }
  }

  // Assign owner to an email
  async assignOwnerToEmail(emailId: string, ownerId: string): Promise<void> {
    await this.request(
      `/crm/v3/objects/emails/${emailId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          properties: {
            hubspot_owner_id: ownerId,
          },
        }),
      }
    )
  }

  // Fetch all emails in a thread (for context in AI draft generation)
  async getEmailThread(threadId: string): Promise<
    { direction: string; text: string; timestamp: string; subject: string }[]
  > {
    try {
      const response = await this.request<{
        results: Array<{
          properties: {
            hs_email_direction?: string
            hs_email_text?: string
            hs_timestamp?: string
            hs_email_subject?: string
          }
        }>
      }>('/crm/v3/objects/emails/search', {
        method: 'POST',
        body: JSON.stringify({
          filterGroups: [
            {
              filters: [
                {
                  propertyName: 'hs_email_thread_id',
                  operator: 'EQ',
                  value: threadId,
                },
              ],
            },
          ],
          properties: ['hs_email_direction', 'hs_email_text', 'hs_email_subject', 'hs_timestamp'],
          sorts: [{ propertyName: 'hs_timestamp', direction: 'ASCENDING' }],
          limit: 10,
        }),
      })

      return (response.results || []).map((e) => ({
        direction: e.properties.hs_email_direction || 'INCOMING_EMAIL',
        text: (e.properties.hs_email_text || '').substring(0, 1500),
        timestamp: e.properties.hs_timestamp || '',
        subject: e.properties.hs_email_subject || '',
      }))
    } catch (e) {
      console.error('Failed to fetch email thread from HubSpot:', e)
      return []
    }
  }

  // Log outgoing reply via v3 CRM email API (proper thread association)
  async createReplyEngagementV3(params: {
    to: string
    subject: string
    body: string
    threadId?: string
    contactId?: string
    fromEmail: string
    status: 'SENT' | 'DRAFT'
  }): Promise<string> {
    try {
      const properties: Record<string, string> = {
        hs_email_direction: 'EMAIL',
        hs_email_subject: params.subject,
        hs_email_text: params.body,
        hs_email_to_email: params.to,
        hs_email_from_email: params.fromEmail,
        hs_email_status: params.status,
      }
      if (params.threadId) {
        properties.hs_email_thread_id = params.threadId
      }

      const body: Record<string, unknown> = { properties }

      if (params.contactId) {
        body.associations = [
          {
            to: { id: params.contactId },
            types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 198 }],
          },
        ]
      }

      const response = await this.request<{ id: string }>('/crm/v3/objects/emails', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      return response.id
    } catch (e) {
      console.error('Failed to create v3 email engagement:', e)
      return ''
    }
  }

  // Update email engagement (e.g., mark as completed/replied)
  async updateEmailStatus(emailId: string, status: 'SENT' | 'REPLIED'): Promise<void> {
    await this.request(
      `/crm/v3/objects/emails/${emailId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          properties: {
            hs_email_status: status,
          },
        }),
      }
    )
  }

  // Ensure custom properties exist in HubSpot (idempotent - creates if missing)
  async ensureCustomProperties(): Promise<void> {
    const properties = [
      { name: 'palai_priority', label: 'Palai Priority', type: 'string', fieldType: 'text', groupName: 'contactinformation', description: 'Email priority from palai' },
      { name: 'palai_support_level', label: 'Palai Support Level', type: 'string', fieldType: 'text', groupName: 'contactinformation', description: 'Support level from palai' },
      { name: 'palai_topic', label: 'Palai Topic', type: 'string', fieldType: 'text', groupName: 'contactinformation', description: 'Topic cluster from palai' },
      { name: 'palai_sentiment', label: 'Palai Sentiment', type: 'string', fieldType: 'text', groupName: 'contactinformation', description: 'Tone sentiment from palai' },
      { name: 'palai_sla_status', label: 'Palai SLA Status', type: 'string', fieldType: 'text', groupName: 'contactinformation', description: 'SLA status from palai' },
      { name: 'palai_last_email_date', label: 'Palai Last Email Date', type: 'string', fieldType: 'text', groupName: 'contactinformation', description: 'Last email date from palai' },
      { name: 'palai_total_emails', label: 'Palai Total Emails', type: 'number', fieldType: 'number', groupName: 'contactinformation', description: 'Total email count from palai' },
      { name: 'palai_buying_intent', label: 'Palai Buying Intent', type: 'number', fieldType: 'number', groupName: 'contactinformation', description: 'Buying intent score from palai' },
    ]

    for (const prop of properties) {
      try {
        await this.request('/crm/v3/properties/contacts', {
          method: 'POST',
          body: JSON.stringify(prop),
        })
      } catch (e) {
        // 409 means property already exists — that's fine
        const msg = e instanceof Error ? e.message : String(e)
        if (!msg.includes('409')) {
          console.error(`Failed to create property ${prop.name}:`, msg)
        }
      }
    }
  }

  // Sync email data to HubSpot contact properties
  async syncContactProperties(params: {
    contactEmail: string
    properties: {
      palai_priority?: string
      palai_support_level?: string
      palai_topic?: string
      palai_sentiment?: string
      palai_sla_status?: string
      palai_last_email_date?: string
      palai_total_emails?: number
      palai_buying_intent?: number
    }
  }): Promise<boolean> {
    try {
      const contact = await this.getContactByEmail(params.contactEmail)
      if (!contact) {
        console.log(`HubSpot contact not found for ${params.contactEmail}`)
        return false
      }

      // Filter out undefined values
      const cleanProperties: Record<string, string | number> = {}
      for (const [key, value] of Object.entries(params.properties)) {
        if (value !== undefined && value !== null) {
          cleanProperties[key] = value
        }
      }

      if (Object.keys(cleanProperties).length === 0) {
        return true
      }

      await this.request(`/crm/v3/objects/contacts/${contact.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ properties: cleanProperties }),
      })

      return true
    } catch (e) {
      console.error(`Failed to sync properties for ${params.contactEmail}:`, e)
      return false
    }
  }
}

export function createHubSpotClient(): HubSpotClient {
  return new HubSpotClient()
}

export type { HubSpotEmail, HubSpotContact, HubSpotOwner }
