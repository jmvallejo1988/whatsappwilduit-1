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
  status: string
  effective_status: string
  objective: string
  daily_budget?: string
  lifetime_budget?: string
}

export async function getActiveCampaigns(): Promise<Campaign[]> {
  const account = getAdAccount()
  const data = await metaGet(`${account}/campaigns`, {
    fields: 'id,name,status,effective_status,objective,daily_budget,lifetime_budget',
    filtering: JSON.stringify([{ field: 'effective_status', operator: 'IN', value: ['ACTIVE', 'PAUSED'] }]),
    limit: '20',
  }) as { data: Campaign[] }
  return data.data || []
}

export async function getAccountOverview(): Promise<{
  spend_today: string
  spend_7d: string
  reach_7d: string
  impressions_7d: string
  clicks_7d: string
  ctr_7d: string
}> {
  const account = getAdAccount()
  const today = new Date().toISOString().split('T')[0]
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [todayData, weekData] = await Promise.all([
    metaGet(`${account}/insights`, {
      fields: 'spend',
      time_range: JSON.stringify({ since: today, until: today }),
    }) as Promise<{ data: Array<{ spend: string }> }>,
    metaGet(`${account}/insights`, {
      fields: 'spend,reach,impressions,clicks,ctr',
      time_range: JSON.stringify({ since: sevenDaysAgo, until: today }),
    }) as Promise<{ data: Array<{ spend: string; reach: string; impressions: string; clicks: string; ctr: string }> }>,
  ])

  const t = (todayData as { data: Array<{ spend: string }> }).data?.[0]
  const w = (weekData as { data: Array<{ spend: string; reach: string; impressions: string; clicks: string; ctr: string }> }).data?.[0]

  return {
    spend_today: t?.spend || '0',
    spend_7d: w?.spend || '0',
    reach_7d: w?.reach || '0',
    impressions_7d: w?.impressions || '0',
    clicks_7d: w?.clicks || '0',
    ctr_7d: w?.ctr || '0',
  }
}

export type CampaignInsights = {
  spend: string
  reach: string
  impressions: string
  clicks: string
  ctr: string
  cpc: string
  cpm: string
  frequency: string
  actions?: Array<{ action_type: string; value: string }>
}

export async function getCampaignInsights(campaignId: string): Promise<CampaignInsights | null> {
  const today = new Date().toISOString().split('T')[0]
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  try {
    const data = await metaGet(`${campaignId}/insights`, {
      fields: 'spend,reach,impressions,clicks,ctr,cpc,cpm,frequency,actions',
      time_range: JSON.stringify({ since: sevenDaysAgo, until: today }),
    }) as { data: CampaignInsights[] }
    return data.data?.[0] || null
  } catch {
    return null
  }
}

export async function getTopAds(campaignId: string): Promise<Array<{ name: string; ctr: string }>> {
  const today = new Date().toISOString().split('T')[0]
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  try {
    const data = await metaGet(`${campaignId}/ads`, {
      fields: 'name,insights{ctr,spend}',
      time_range: JSON.stringify({ since: sevenDaysAgo, until: today }),
      limit: '5',
    }) as { data: Array<{ name: string; insights?: { data: Array<{ ctr: string }> } }> }

    return (data.data || [])
      .filter((ad) => ad.insights?.data?.[0]?.ctr)
      .map((ad) => ({ name: ad.name, ctr: ad.insights!.data[0].ctr }))
      .sort((a, b) => parseFloat(b.ctr) - parseFloat(a.ctr))
      .slice(0, 3)
  } catch {
    return []
  }
}

export function formatBudget(campaign: Campaign): string {
  if (campaign.daily_budget) return `$${(parseInt(campaign.daily_budget) / 100).toFixed(2)}/día`
  if (campaign.lifetime_budget) return `$${(parseInt(campaign.lifetime_budget) / 100).toFixed(2)} total`
  return '—'
}

export function getActionValue(actions: CampaignInsights['actions'], type: string): string {
  return actions?.find((a) => a.action_type === type)?.value || '0'
}

export function objectiveLabel(objective: string): string {
  const map: Record<string, string> = {
    OUTCOME_LEADS: 'Leads',
    OUTCOME_TRAFFIC: 'Tráfico',
    OUTCOME_AWARENESS: 'Reconocimiento',
    OUTCOME_ENGAGEMENT: 'Interacción',
    OUTCOME_SALES: 'Ventas',
    OUTCOME_APP_PROMOTION: 'App',
    LINK_CLICKS: 'Clics',
    MESSAGES: 'Mensajes',
    CONVERSIONS: 'Conversiones',
    LEAD_GENERATION: 'Generación de leads',
    BRAND_AWARENESS: 'Reconocimiento de marca',
    REACH: 'Alcance',
  }
  return map[objective] || objective
}
