const HUBSPOT_API_BASE = 'https://api.hubapi.com'

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

  // Send email reply
  async sendEmail(params: {
    to: string
    subject: string
    body: string
    threadId?: string
    contactId?: string
  }): Promise<{ id: string }> {
    // Create email engagement
    const emailData = {
      properties: {
        hs_email_direction: 'EMAIL',
        hs_email_status: 'SENT',
        hs_email_subject: params.subject,
        hs_email_text: params.body,
        hs_email_to_email: params.to,
        hs_timestamp: Date.now(),
        ...(params.threadId && { hs_email_thread_id: params.threadId }),
      },
    }

    const response = await this.request<{ id: string }>(
      '/crm/v3/objects/emails',
      {
        method: 'POST',
        body: JSON.stringify(emailData),
      }
    )

    // Associate with contact if provided
    if (params.contactId) {
      try {
        await this.request(
          `/crm/v3/objects/emails/${response.id}/associations/contacts/${params.contactId}/email_to_contact`,
          { method: 'PUT' }
        )
      } catch (e) {
        console.error('Failed to associate email with contact:', e)
      }
    }

    return response
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
