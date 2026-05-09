const BASE = 'https://graph.facebook.com/v21.0'

function getToken(): string {
  return (
    process.env.META_ADS_TOKEN ||
    'EAALha5RxPekBRDkaueNsXAW8x3E7FjkpFlPn6ZAkRXYubKtLiBC0TtUGX2pVIA9EU3tTMn9XFvn1F6NZCJ27TjY3yPqAesylDUem6ds9LAC3ZCH5ODUGO0QQSZAC7zsHY9yO4dpmFgE7rK6WfAkvcyxPQRPumCgBZAwa27S6XSN2cJPmP6O8lCg9UI52BtwZDZD'
  )
}

function getAdAccount(): string {
  return process.env.META_AD_ACCOUNT_ID || 'act_742059521944105'
}

// All ad accounts managed by Wilduit
export const AD_ACCOUNTS: Array<{ id: string; name: string; emoji: string }> = [
  { id: 'act_157012131074583',   name: 'ASOINMED',        emoji: '🏥' },
  { id: 'act_3255653561331232',  name: 'OMEGA SAMBO',     emoji: '🥊' },
  { id: 'act_705761368458003',   name: 'ELIXIR NATURAL',  emoji: '🌿' },
  { id: 'act_742059521944105',   name: 'WILDUIT ECUADOR', emoji: '📱' },
  { id: 'act_1854968711885423',  name: 'NAOS PAUTAS',     emoji: '💅' },
]

// Returns { since: 'YYYY-MM-DD', until: 'YYYY-MM-DD' } from the 1st of current month to today
export function currentMonthRange(): { since: string; until: string } {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const since = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`
  const until = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  return { since, until }
}

async function metaGet(path: string, params: Record<string, string> = {}): Promise<unknown> {
  const token = getToken()
  const qs = new URLSearchParams({ ...params, access_token: token }).toString()
  const url = `${BASE}/${path}?${qs}`
  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Meta API ${res.status}: ${err}`)
  }
  return res.json()
}

export type Campaign = {
  id: string
  name: string
  effective_status: string
  objective: string
  daily_budget?: string
  lifetime_budget?: string
  budget_remaining?: string
}

export type CampaignInsights = {
  campaign_id: string
  campaign_name: string
  spend: string
  impressions: string
  reach: string
  clicks: string
  cpc: string
  cpm: string
  ctr: string
  frequency: string
  actions?: Array<{ action_type: string; value: string }>
}

export type AccountOverview = {
  spend_today: string
  spend_7d: string
  impressions_7d: string
  reach_7d: string
  clicks_7d: string
  ctr_7d: string
}

// Returns all active campaigns with their budgets
export async function getActiveCampaigns(): Promise<Campaign[]> {
  const act = getAdAccount()
  const data = await metaGet(`${act}/campaigns`, {
    fields: 'id,name,effective_status,objective,daily_budget,lifetime_budget,budget_remaining',
    effective_status: '["ACTIVE","PAUSED"]',
    limit: '50',
  }) as { data: Campaign[] }
  return (data.data || []).filter(
    (c) => c.effective_status === 'ACTIVE' || c.effective_status === 'PAUSED'
  )
}

// Returns account-level spend overview (today + current month)
export async function getAccountOverview(): Promise<AccountOverview> {
  const act = getAdAccount()
  const { since, until } = currentMonthRange()

  const [today, month] = await Promise.all([
    metaGet(`${act}/insights`, {
      fields: 'spend',
      date_preset: 'today',
    }) as Promise<{ data: Array<{ spend: string }> }>,
    metaGet(`${act}/insights`, {
      fields: 'spend,impressions,reach,clicks,ctr',
      time_range: JSON.stringify({ since, until }),
    }) as Promise<{ data: Array<{ spend: string; impressions: string; reach: string; clicks: string; ctr: string }> }>,
  ])

  const t = (today as { data: Array<{ spend: string }> }).data?.[0] || {}
  const w = (month as { data: Array<{ spend: string; impressions: string; reach: string; clicks: string; ctr: string }> }).data?.[0] || {}

  return {
    spend_today: t.spend || '0',
    spend_7d: w.spend || '0',
    impressions_7d: w.impressions || '0',
    reach_7d: w.reach || '0',
    clicks_7d: w.clicks || '0',
    ctr_7d: w.ctr || '0',
  }
}

// Returns deep insights for a specific campaign (current month)
export async function getCampaignInsights(campaignId: string): Promise<CampaignInsights | null> {
  const { since, until } = currentMonthRange()
  const data = await metaGet(`${campaignId}/insights`, {
    fields: 'campaign_id,campaign_name,spend,impressions,reach,clicks,cpc,cpm,ctr,frequency,actions',
    time_range: JSON.stringify({ since, until }),
  }) as { data: CampaignInsights[] }

  return data.data?.[0] || null
}

// Returns top performing ads for a campaign
export async function getTopAds(campaignId: string): Promise<Array<{ name: string; spend: string; ctr: string; cpc: string }>> {
  const data = await metaGet(`${campaignId}/insights`, {
    fields: 'ad_name,spend,ctr,cpc,impressions',
    level: 'ad',
    date_preset: 'last_7d',
    limit: '5',
  }) as { data: Array<{ ad_name: string; spend: string; ctr: string; cpc: string }> }
  return (data.data || [])
    .sort((a, b) => parseFloat(b.spend || '0') - parseFloat(a.spend || '0'))
    .slice(0, 3)
    .map((r) => ({ name: r.ad_name || '?', spend: r.spend || '0', ctr: r.ctr || '0', cpc: r.cpc || '0' }))
}

// Helper: format budget in cents to dollar string
export function formatBudget(cents?: string): string {
  if (!cents) return '—'
  const n = parseInt(cents)
  if (isNaN(n)) return '—'
  return `$${(n / 100).toFixed(2)}`
}

// Helper: get action count by type
export function getActionValue(
  actions: Array<{ action_type: string; value: string }> | undefined,
  type: string
): string {
  const match = actions?.find((a) => a.action_type === type)
  return match?.value || '0'
}

// Condensed per-campaign data for the multi-account brief report
export type CampaignBrief = {
  campaign_name: string
  spend: string
  impressions: string
  reach: string
  clicks: string
  ctr: string
  messages: string
}

// Returns campaigns with spend > 0 for an account, for the current month range
export async function getAccountCampaignsBrief(accountId: string): Promise<CampaignBrief[]> {
  const { since, until } = currentMonthRange()
  const data = await metaGet(`${accountId}/insights`, {
    fields: 'campaign_name,spend,impressions,reach,clicks,ctr,actions',
    level: 'campaign',
    time_range: JSON.stringify({ since, until }),
    limit: '30',
  }) as {
    data: Array<{
      campaign_name: string
      spend: string
      impressions: string
      reach: string
      clicks: string
      ctr: string
      actions?: Array<{ action_type: string; value: string }>
    }>
  }

  return (data.data || [])
    .filter((r) => parseFloat(r.spend || '0') > 0)
    .sort((a, b) => parseFloat(b.spend || '0') - parseFloat(a.spend || '0'))
    .map((r) => ({
      campaign_name: r.campaign_name,
      spend: r.spend || '0',
      impressions: r.impressions || '0',
      reach: r.reach || '0',
      clicks: r.clicks || '0',
      ctr: r.ctr || '0',
      messages: getActionValue(
        r.actions,
        'onsite_conversion.messaging_conversation_started_7d'
      ),
    }))
}

export function objectiveLabel(obj: string): string {
  const map: Record<string, string> = {
    OUTCOME_LEADS: 'Leads',
    OUTCOME_TRAFFIC: 'Tráfico',
    OUTCOME_ENGAGEMENT: 'Interacción',
    OUTCOME_AWARENESS: 'Alcance',
    OUTCOME_SALES: 'Ventas',
    OUTCOME_APP_PROMOTION: 'App',
    LEAD_GENERATION: 'Leads',
    LINK_CLICKS: 'Tráfico',
    POST_ENGAGEMENT: 'Interacción',
    MESSAGES: 'Mensajes',
    CONVERSIONS: 'Conversiones',
  }
  return map[obj] || obj
}


// ── Page Insights for MetricasWilduit ─────────────────────────────────────────

export type PageInsightsResult = {
  page: { id: string; name: string; fan_count?: number }
  impressions_week?: string
  engaged_users_week?: string
  new_followers_week?: string
  page_views_week?: string
  error?: string
}

// Returns insights for all Facebook Pages owned by the Business Manager
export async function getAllPagesInsights(): Promise<PageInsightsResult[]> {
  const businessId = process.env.META_BUSINESS_ID || '1792760321017187'

  // Step 1: get all owned pages from BM
  let pages: Array<{ id: string; name: string; fan_count?: number }> = []
  try {
    const pagesData = await metaGet(`${businessId}/owned_pages`, {
      fields: 'id,name,fan_count',
      limit: '25',
    }) as { data: Array<{ id: string; name: string; fan_count?: number }> }
    pages = pagesData.data || []
  } catch {
    // fallback: try client pages via /me/accounts
    try {
      const meData = await metaGet('me/accounts', {
        fields: 'id,name,fan_count',
        limit: '25',
      }) as { data: Array<{ id: string; name: string; fan_count?: number }> }
      pages = meData.data || []
    } catch {
      return []
    }
  }

  if (!pages.length) return []

  // Step 2: for each page, get weekly insights
  const results = await Promise.allSettled(
    pages.map(async (page): Promise<PageInsightsResult> => {
      try {
        const insights = await metaGet(`${page.id}/insights`, {
          metric: 'page_impressions,page_engaged_users,page_fan_adds,page_views_total',
          period: 'week',
          limit: '10',
        }) as { data: Array<{ name: string; values: Array<{ value: number }> }> }

        const getLatest = (name: string): string => {
          const entry = insights.data?.find((d) => d.name === name)
          const val = entry?.values?.[entry.values.length - 1]?.value ?? 0
          return String(val)
        }

        return {
          page,
          impressions_week: getLatest('page_impressions'),
          engaged_users_week: getLatest('page_engaged_users'),
          new_followers_week: getLatest('page_fan_adds'),
          page_views_week: getLatest('page_views_total'),
        }
      } catch (err) {
        return {
          page,
          error: err instanceof Error ? err.message.slice(0, 120) : 'Error desconocido',
        }
      }
    })
  )

  return results.map((r, i) => {
    if (r.status === 'rejected') {
      return {
        page: pages[i],
        error: String(r.reason).slice(0, 120),
      }
    }
    return r.value
  })
}
