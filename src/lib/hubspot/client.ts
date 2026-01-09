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

    // Log email to HubSpot as engagement (regardless of whether it was actually sent)
    const engagementData = {
      engagement: {
        active: true,
        type: 'EMAIL',
        timestamp: Date.now(),
      },
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

    try {
      const response = await this.request<{ engagement: { id: number } }>(
        '/engagements/v1/engagements',
        {
          method: 'POST',
          body: JSON.stringify(engagementData),
        }
      )
      emailId = emailId || String(response.engagement.id)
    } catch (e) {
      console.error('Failed to log email to HubSpot:', e)
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
}

export function createHubSpotClient(): HubSpotClient {
  return new HubSpotClient()
}

export type { HubSpotEmail, HubSpotContact, HubSpotOwner }
