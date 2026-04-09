import { NextRequest, NextResponse } from 'next/server'

const HUBSPOT_API_BASE = 'https://api.hubapi.com'

interface HubSpotContact {
  id: string
  properties: Record<string, string | null>
}

interface HubSpotSearchResponse {
  total: number
  results: HubSpotContact[]
  paging?: { next?: { after: string } }
}

async function hubspotRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = process.env.HUBSPOT_ACCESS_TOKEN
  if (!token) throw new Error('HUBSPOT_ACCESS_TOKEN is not set')

  const url = `${HUBSPOT_API_BASE}${endpoint}`
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
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

// Contact properties we need for funnel analysis
const CONTACT_PROPERTIES = [
  'firstname',
  'lastname',
  'email',
  'createdate',
  'lifecyclestage',
  // First touch attribution
  'hs_analytics_source',
  'hs_analytics_source_data_1',
  'hs_analytics_source_data_2',
  'hs_analytics_first_url',
  'hs_analytics_first_referrer',
  'hs_analytics_first_touch_converting_campaign',
  // Last touch attribution
  'hs_analytics_last_url',
  'hs_analytics_last_referrer',
  'hs_analytics_last_touch_converting_campaign',
  // Conversion info
  'first_conversion_event_name',
  'first_conversion_date',
  'recent_conversion_event_name',
  'recent_conversion_date',
  'num_conversion_events',
  // Analytics
  'hs_analytics_num_page_views',
  'hs_analytics_num_visits',
  'hs_analytics_num_event_completions',
  'hs_analytics_average_page_views',
  // Additional
  'hs_lifecyclestage_lead_date',
  'hs_lifecyclestage_marketingqualifiedlead_date',
  'hs_lifecyclestage_salesqualifiedlead_date',
  'hs_lifecyclestage_opportunity_date',
  'hs_lifecyclestage_customer_date',
]

async function fetchAllContacts(filterGroups: unknown[]): Promise<HubSpotContact[]> {
  const allContacts: HubSpotContact[] = []
  let after: string | undefined

  // Paginate through all results (max 10 pages = 1000 contacts for safety)
  for (let page = 0; page < 10; page++) {
    const body: Record<string, unknown> = {
      filterGroups,
      properties: CONTACT_PROPERTIES,
      limit: 100,
      sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }],
    }

    if (after) {
      body.after = after
    }

    const response = await hubspotRequest<HubSpotSearchResponse>(
      '/crm/v3/objects/contacts/search',
      { method: 'POST', body: JSON.stringify(body) }
    )

    allContacts.push(...response.results)

    if (!response.paging?.next?.after) break
    after = response.paging.next.after
  }

  return allContacts
}

function getSourceLabel(source: string | null): string {
  const labels: Record<string, string> = {
    ORGANIC_SEARCH: 'Organische Suche',
    PAID_SEARCH: 'Bezahlte Suche',
    DIRECT_TRAFFIC: 'Direkter Traffic',
    SOCIAL_MEDIA: 'Social Media',
    EMAIL_MARKETING: 'E-Mail Marketing',
    REFERRALS: 'Verweise',
    OTHER_CAMPAIGNS: 'Andere Kampagnen',
    PAID_SOCIAL: 'Bezahlte Social Ads',
    OFFLINE: 'Offline',
    ORGANIC_SOCIAL: 'Organische Social',
  }
  return labels[source || ''] || source || 'Unbekannt'
}

interface FunnelStage {
  name: string
  count: number
  contacts: Array<{
    id: string
    name: string
    email: string
    date: string | null
  }>
}

function buildLifecycleFunnel(contacts: HubSpotContact[]): FunnelStage[] {
  const stages: { key: string; name: string; dateField: string }[] = [
    { key: 'subscriber', name: 'Subscriber', dateField: 'createdate' },
    { key: 'lead', name: 'Lead', dateField: 'hs_lifecyclestage_lead_date' },
    { key: 'marketingqualifiedlead', name: 'Marketing Qualified Lead', dateField: 'hs_lifecyclestage_marketingqualifiedlead_date' },
    { key: 'salesqualifiedlead', name: 'Sales Qualified Lead', dateField: 'hs_lifecyclestage_salesqualifiedlead_date' },
    { key: 'opportunity', name: 'Opportunity', dateField: 'hs_lifecyclestage_opportunity_date' },
    { key: 'customer', name: 'Customer', dateField: 'hs_lifecyclestage_customer_date' },
  ]

  const stageOrder = stages.map(s => s.key)

  return stages.map(stage => {
    const stageIdx = stageOrder.indexOf(stage.key)
    const contactsInStage = contacts.filter(c => {
      const contactStage = (c.properties.lifecyclestage || '').toLowerCase()
      const contactIdx = stageOrder.indexOf(contactStage)
      // Contact is in this stage or has passed through it
      return contactIdx >= stageIdx
    })

    return {
      name: stage.name,
      count: contactsInStage.length,
      contacts: contactsInStage.slice(0, 5).map(c => ({
        id: c.id,
        name: [c.properties.firstname, c.properties.lastname].filter(Boolean).join(' ') || c.properties.email || 'Unbekannt',
        email: c.properties.email || '',
        date: c.properties[stage.dateField] || null,
      })),
    }
  })
}

interface AttributionBucket {
  source: string
  count: number
  percentage: number
  contacts: Array<{ id: string; name: string; email: string }>
}

function buildAttributionAnalysis(
  contacts: HubSpotContact[],
  type: 'first_touch' | 'last_touch'
): {
  bySource: AttributionBucket[]
  byCampaign: AttributionBucket[]
  byUrl: AttributionBucket[]
  byReferrer: AttributionBucket[]
} {
  const sourceField = 'hs_analytics_source' // same property, represents original source
  const campaignField = type === 'first_touch'
    ? 'hs_analytics_first_touch_converting_campaign'
    : 'hs_analytics_last_touch_converting_campaign'
  const urlField = type === 'first_touch'
    ? 'hs_analytics_first_url'
    : 'hs_analytics_last_url'
  const referrerField = type === 'first_touch'
    ? 'hs_analytics_first_referrer'
    : 'hs_analytics_last_referrer'

  function aggregate(field: string, labelFn?: (v: string) => string): AttributionBucket[] {
    const map = new Map<string, HubSpotContact[]>()
    for (const contact of contacts) {
      const value = contact.properties[field] || 'Unbekannt'
      const label = labelFn ? labelFn(value) : value
      if (!map.has(label)) map.set(label, [])
      map.get(label)!.push(contact)
    }

    const total = contacts.length || 1
    return Array.from(map.entries())
      .map(([source, sourceContacts]) => ({
        source,
        count: sourceContacts.length,
        percentage: Math.round((sourceContacts.length / total) * 100),
        contacts: sourceContacts.slice(0, 3).map(c => ({
          id: c.id,
          name: [c.properties.firstname, c.properties.lastname].filter(Boolean).join(' ') || 'Unbekannt',
          email: c.properties.email || '',
        })),
      }))
      .sort((a, b) => b.count - a.count)
  }

  function simplifyUrl(url: string): string {
    if (!url || url === 'Unbekannt') return 'Unbekannt'
    try {
      const parsed = new URL(url)
      return parsed.pathname || '/'
    } catch {
      return url
    }
  }

  function simplifyReferrer(url: string): string {
    if (!url || url === 'Unbekannt') return 'Unbekannt'
    try {
      const parsed = new URL(url)
      return parsed.hostname
    } catch {
      return url
    }
  }

  return {
    bySource: aggregate(sourceField, getSourceLabel),
    byCampaign: aggregate(campaignField),
    byUrl: aggregate(urlField, simplifyUrl),
    byReferrer: aggregate(referrerField, simplifyReferrer),
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const formName = searchParams.get('form') || 'eignungscheck'

    // Search for contacts that converted through the Eignungscheck form
    // We search across multiple conversion properties
    const filterGroups = [
      {
        filters: [
          {
            propertyName: 'recent_conversion_event_name',
            operator: 'CONTAINS_TOKEN',
            value: `*${formName}*`,
          },
        ],
      },
      {
        filters: [
          {
            propertyName: 'first_conversion_event_name',
            operator: 'CONTAINS_TOKEN',
            value: `*${formName}*`,
          },
        ],
      },
    ]

    let contacts = await fetchAllContacts(filterGroups)

    // If no contacts found with token search, try broader search
    if (contacts.length === 0) {
      const broaderFilters = [
        {
          filters: [
            {
              propertyName: 'recent_conversion_event_name',
              operator: 'HAS_PROPERTY',
            },
          ],
        },
      ]
      const allConverted = await fetchAllContacts(broaderFilters)

      // Filter client-side for "eignungscheck" or "käufer" in conversion names
      contacts = allConverted.filter(c => {
        const first = (c.properties.first_conversion_event_name || '').toLowerCase()
        const recent = (c.properties.recent_conversion_event_name || '').toLowerCase()
        const searchTerm = formName.toLowerCase()
        return first.includes(searchTerm) || recent.includes(searchTerm) ||
               first.includes('käufer') || recent.includes('käufer') ||
               first.includes('kaeufer') || recent.includes('kaeufer') ||
               first.includes('buyer') || recent.includes('buyer') ||
               first.includes('eignung') || recent.includes('eignung')
      })
    }

    // Build funnel analysis
    const lifecycleFunnel = buildLifecycleFunnel(contacts)
    const firstTouchAttribution = buildAttributionAnalysis(contacts, 'first_touch')
    const lastTouchAttribution = buildAttributionAnalysis(contacts, 'last_touch')

    // Conversion timeline - group by month
    const timeline: Record<string, number> = {}
    for (const contact of contacts) {
      const date = contact.properties.first_conversion_date || contact.properties.createdate
      if (date) {
        const month = date.substring(0, 7) // YYYY-MM
        timeline[month] = (timeline[month] || 0) + 1
      }
    }
    const conversionTimeline = Object.entries(timeline)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month))

    // Summary stats
    const avgPageViews = contacts.length > 0
      ? Math.round(
          contacts.reduce((sum, c) => sum + (parseInt(c.properties.hs_analytics_num_page_views || '0') || 0), 0) / contacts.length
        )
      : 0

    const avgVisits = contacts.length > 0
      ? Math.round(
          contacts.reduce((sum, c) => sum + (parseInt(c.properties.hs_analytics_num_visits || '0') || 0), 0) / contacts.length * 10
        ) / 10
      : 0

    // Unique conversion event names found
    const conversionEvents = new Set<string>()
    for (const c of contacts) {
      if (c.properties.first_conversion_event_name) conversionEvents.add(c.properties.first_conversion_event_name)
      if (c.properties.recent_conversion_event_name) conversionEvents.add(c.properties.recent_conversion_event_name)
    }

    return NextResponse.json({
      formName,
      totalContacts: contacts.length,
      conversionEvents: Array.from(conversionEvents),
      summary: {
        totalContacts: contacts.length,
        avgPageViews,
        avgVisits,
        avgConversions: contacts.length > 0
          ? Math.round(
              contacts.reduce((sum, c) => sum + (parseInt(c.properties.num_conversion_events || '0') || 0), 0) / contacts.length * 10
            ) / 10
          : 0,
      },
      lifecycleFunnel,
      firstTouch: firstTouchAttribution,
      lastTouch: lastTouchAttribution,
      conversionTimeline,
      contacts: contacts.slice(0, 50).map(c => ({
        id: c.id,
        name: [c.properties.firstname, c.properties.lastname].filter(Boolean).join(' ') || 'Unbekannt',
        email: c.properties.email || '',
        lifecyclestage: c.properties.lifecyclestage || '',
        source: getSourceLabel(c.properties.hs_analytics_source),
        firstUrl: c.properties.hs_analytics_first_url || '',
        lastUrl: c.properties.hs_analytics_last_url || '',
        firstTouchCampaign: c.properties.hs_analytics_first_touch_converting_campaign || '',
        lastTouchCampaign: c.properties.hs_analytics_last_touch_converting_campaign || '',
        firstConversion: c.properties.first_conversion_event_name || '',
        recentConversion: c.properties.recent_conversion_event_name || '',
        firstConversionDate: c.properties.first_conversion_date || '',
        recentConversionDate: c.properties.recent_conversion_date || '',
        pageViews: parseInt(c.properties.hs_analytics_num_page_views || '0') || 0,
        visits: parseInt(c.properties.hs_analytics_num_visits || '0') || 0,
        createdate: c.properties.createdate || '',
      })),
    })
  } catch (error) {
    console.error('Buyer funnel API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch buyer funnel data', details: String(error) },
      { status: 500 }
    )
  }
}
