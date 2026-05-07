import redis from './redis'
import {
  getActiveCampaigns,
  getAccountOverview,
  getCampaignInsights,
  getTopAds,
  formatBudget,
  getActionValue,
  objectiveLabel,
  type Campaign,
} from './meta-api'
import { callOpenRouterLong } from './openrouter'

export const METRICS_TRIGGERS = [
  'reportewilduit',
  'reporte wilduit',
  'rwilduit',
  'rw',
]

const CMD_EXIT = ['salir', 'exit', 'cerrar', 'fin', 'stop']
const CMD_DIAGNOSIS = ['diagnóstico', 'diagnostico', 'analiza', 'análisis', 'analisis', 'diagnostica']
const CMD_ALL = ['todas', 'all', 'global']
const SESSION_TTL = 60 * 60 * 2

type MetricsSession = {
  phase: 1 | 2
  campaigns: Campaign[]
  selectedCampaign?: Campaign
  insightsSnapshot?: string
  ts: number
}

async function getSession(phone: string): Promise<MetricsSession | null> {
  const key = `metrics:session:${phone}`
  const data = await redis.get<MetricsSession>(key)
  if (!data) return null
  if (Date.now() - data.ts > SESSION_TTL * 1000) {
    await redis.del(key)
    return null
  }
  return data
}

async function saveSession(phone: string, session: MetricsSession): Promise<void> {
  await redis.set(`metrics:session:${phone}`, { ...session, ts: Date.now() }, { ex: SESSION_TTL })
}

async function clearSession(phone: string): Promise<void> {
  await redis.del(`metrics:session:${phone}`)
}

export function isMetricsTrigger(text: string): boolean {
  const lower = text.toLowerCase().trim()
  return METRICS_TRIGGERS.some((t) => lower === t || lower.startsWith(t))
}

export async function hasActiveMetricsSession(phone: string): Promise<boolean> {
  const s = await getSession(phone)
  return s !== null
}

function formatPhase1(campaigns: Campaign[], overview: { spend_today: string; spend_7d: string; reach_7d: string; impressions_7d: string; clicks_7d: string; ctr_7d: string }): string {
  const lines: string[] = []
  lines.push('📊 *Reporte Wilduit* — Estado actual\n')
  lines.push(`💰 Gasto hoy: *$${parseFloat(overview.spend_today).toFixed(2)} USD*`)
  lines.push(`📈 Gasto últimos 7 días: *$${parseFloat(overview.spend_7d).toFixed(2)} USD*`)
  lines.push(`👁 Alcance 7d: *${parseInt(overview.reach_7d).toLocaleString()}* personas\n`)

  if (campaigns.length === 0) {
    lines.push('⚠️ Sin campañas activas o pausadas en este momento.')
    return lines.join('\n')
  }

  const active = campaigns.filter((c) => c.effective_status === 'ACTIVE')
  const paused = campaigns.filter((c) => c.effective_status === 'PAUSED')

  if (active.length > 0) {
    lines.push(`🟢 *Campañas ACTIVAS (${active.length}):*`)
    active.forEach((c, i) => {
      const budget = formatBudget(c)
      const obj = objectiveLabel(c.objective)
      lines.push(`  ${i + 1}️⃣ ${c.name}`)
      lines.push(`     💵 ${budget} | 🎯 ${obj}`)
    })
  }

  if (paused.length > 0) {
    lines.push(`\n⏸ *Campañas PAUSADAS (${paused.length}):*`)
    paused.forEach((c, i) => {
      const obj = objectiveLabel(c.objective)
      lines.push(`  ${active.length + i + 1}️⃣ ${c.name} | 🎯 ${obj}`)
    })
  }

  lines.push('\n¿Qué campaña querés auditar? Responde con el *número* o envía *todas* para el resumen global.')
  return lines.join('\n')
}

function formatDeepDive(campaign: Campaign, insights: { spend: string; reach: string; impressions: string; clicks: string; ctr: string; cpc: string; cpm: string; frequency: string; actions?: Array<{ action_type: string; value: string }> } | null, topAds: Array<{ name: string; ctr: string }>): string {
  if (!insights) {
    return `🔍 *${campaign.name}*\n\nSin datos disponibles para los últimos 7 días.`
  }

  const leads = getActionValue(insights.actions, 'lead')
  const messages = getActionValue(insights.actions, 'onsite_conversion.messaging_conversation_started_7d')
  const linkClicks = getActionValue(insights.actions, 'link_click')

  const lines: string[] = []
  lines.push(`🔍 *Deep Dive — ${campaign.name}*`)
  lines.push(`📅 Últimos 7 días\n`)
  lines.push(`👁 Alcance: *${parseInt(insights.reach).toLocaleString()} personas*`)
  lines.push(`📣 Impresiones: *${parseInt(insights.impressions).toLocaleString()}*`)
  lines.push(`🔁 Frecuencia: *${parseFloat(insights.frequency || '0').toFixed(2)}x*`)
  lines.push(`🖱 Clics: *${parseInt(insights.clicks).toLocaleString()}*`)
  lines.push(`📊 CTR: *${parseFloat(insights.ctr || '0').toFixed(2)}%*`)
  lines.push(`💵 CPC: *$${parseFloat(insights.cpc || '0').toFixed(2)}*`)
  lines.push(`📡 CPM: *$${parseFloat(insights.cpm || '0').toFixed(2)}*`)
  lines.push(`💰 Gasto total: *$${parseFloat(insights.spend || '0').toFixed(2)} USD*`)

  const hasResults = leads !== '0' || messages !== '0' || linkClicks !== '0'
  if (hasResults) {
    lines.push(`\n🎯 *Resultados:*`)
    if (leads !== '0') lines.push(`  • Leads: *${leads}*`)
    if (messages !== '0') lines.push(`  • Mensajes iniciados: *${messages}*`)
    if (linkClicks !== '0') lines.push(`  • Link clicks: *${linkClicks}*`)
  }

  if (topAds.length > 0) {
    lines.push(`\n🏆 *Top ads:*`)
    topAds.forEach((ad) => {
      lines.push(`  • ${ad.name.slice(0, 30)} | CTR ${parseFloat(ad.ctr).toFixed(2)}%`)
    })
  }

  lines.push('\nResponde *diagnóstico* para análisis IA, otro número para ver otra campaña, o *salir* para cerrar.')
  return lines.join('\n')
}

async function generateDiagnosis(campaign: Campaign, insightsText: string): Promise<string> {
  const systemPrompt = `Eres un estratega de marketing digital experto en Meta Ads con la metodología Boost Digital de Wilduit Marketing.
Tu objetivo: Analizar métricas de Meta Ads y proponer acciones inmediatas y específicas.
Estilo: Tono juvenil, directo, tutea al lector. Máximo 5 puntos de acción. Cada punto: diagnóstico + acción específica. Usa emojis. Sin relleno. Formato para WhatsApp.`

  const userPrompt = `Analiza estas métricas de la campaña "${campaign.name}" (objetivo: ${objectiveLabel(campaign.objective)}) y da un diagnóstico con acciones concretas:

${insightsText}

Benchmarks: CTR saludable >1% | CPM aceptable <$15 | Frecuencia 1.5-3.0 (>5 = fatiga)

Proporciona: (1) diagnóstico rápido, (2) 3-5 acciones concretas para optimizar.`

  try {
    const result = await callOpenRouterLong(userPrompt, systemPrompt)
    return `🧠 *Diagnóstico IA — ${campaign.name}*\n\n${result}\n\n_Responde con un número para ver otra campaña o *salir* para cerrar._`
  } catch {
    return `⚠️ Error al generar diagnóstico IA. Intenta de nuevo con *diagnóstico*.`
  }
}

export async function handleMetricsMessage(
  phone: string,
  text: string,
  isNewTrigger: boolean
): Promise<string> {
  const lower = text.toLowerCase().trim()

  if (CMD_EXIT.some((c) => lower === c)) {
    await clearSession(phone)
    return '✅ Sesión de métricas cerrada. Cuando quieras un nuevo reporte, escribe *ReporteWilduit*.'
  }

  const session = await getSession(phone)

  if (isNewTrigger || !session) {
    let campaigns: Campaign[] = []
    let overview
    try {
      ;[campaigns, overview] = await Promise.all([getActiveCampaigns(), getAccountOverview()])
    } catch (err) {
      console.error('META_API_ERROR', err)
      return '⚠️ Error al conectar con Meta Ads. Verifica que el token esté activo e intenta de nuevo.'
    }

    const newSession: MetricsSession = { phase: 1, campaigns, ts: Date.now() }
    await saveSession(phone, newSession)
    return formatPhase1(campaigns, overview)
  }

  if (session.phase === 1) {
    const { campaigns } = session

    if (CMD_ALL.some((c) => lower === c)) {
      try {
        const overview = await getAccountOverview()
        await clearSession(phone)
        return (
          `📊 *Resumen Global Wilduit* — Últimos 7 días\n\n` +
          `💰 Gasto total: *$${parseFloat(overview.spend_7d).toFixed(2)} USD*\n` +
          `👁 Alcance: *${parseInt(overview.reach_7d).toLocaleString()} personas*\n` +
          `📣 Impresiones: *${parseInt(overview.impressions_7d).toLocaleString()}*\n` +
          `🖱 Clics: *${parseInt(overview.clicks_7d).toLocaleString()}*\n` +
          `📊 CTR: *${parseFloat(overview.ctr_7d).toFixed(2)}%*\n\n` +
          `Escribe *ReporteWilduit* para un nuevo reporte.`
        )
      } catch {
        return '⚠️ Error al obtener datos. Intenta de nuevo.'
      }
    }

    const num = parseInt(lower)
    if (!isNaN(num) && num >= 1 && num <= campaigns.length) {
      const selected = campaigns[num - 1]
      try {
        const [insights, topAds] = await Promise.all([
          getCampaignInsights(selected.id),
          getTopAds(selected.id),
        ])
        const snapshot = insights
          ? `Spend: $${insights.spend} | Reach: ${insights.reach} | Impressions: ${insights.impressions} | Clicks: ${insights.clicks} | CTR: ${insights.ctr}% | CPC: $${insights.cpc} | CPM: $${insights.cpm} | Frequency: ${insights.frequency} | Leads: ${getActionValue(insights.actions, 'lead')} | Messages: ${getActionValue(insights.actions, 'onsite_conversion.messaging_conversation_started_7d')}`
          : 'Sin datos'
        await saveSession(phone, { phase: 2, campaigns, selectedCampaign: selected, insightsSnapshot: snapshot, ts: Date.now() })
        return formatDeepDive(selected, insights, topAds)
      } catch {
        return `⚠️ Error al obtener datos de "${selected.name}". Intenta de nuevo.`
      }
    }

    return `Responde con el número de la campaña (1-${campaigns.length}), *todas* para resumen global, o *salir* para cerrar.`
  }

  if (session.phase === 2) {
    const { campaigns, selectedCampaign, insightsSnapshot } = session

    if (CMD_DIAGNOSIS.some((c) => lower === c || lower.startsWith(c))) {
      if (!selectedCampaign) return '⚠️ Error de sesión. Escribe *ReporteWilduit* para reiniciar.'
      return await generateDiagnosis(selectedCampaign, insightsSnapshot || 'Sin datos')
    }

    const num = parseInt(lower)
    if (!isNaN(num) && num >= 1 && num <= campaigns.length) {
      const selected = campaigns[num - 1]
      try {
        const [insights, topAds] = await Promise.all([
          getCampaignInsights(selected.id),
          getTopAds(selected.id),
        ])
        const snapshot = insights
          ? `Spend: $${insights.spend} | Reach: ${insights.reach} | Impressions: ${insights.impressions} | Clicks: ${insights.clicks} | CTR: ${insights.ctr}% | CPC: $${insights.cpc} | CPM: $${insights.cpm} | Frequency: ${insights.frequency} | Leads: ${getActionValue(insights.actions, 'lead')} | Messages: ${getActionValue(insights.actions, 'onsite_conversion.messaging_conversation_started_7d')}`
          : 'Sin datos'
        await saveSession(phone, { phase: 2, campaigns, selectedCampaign: selected, insightsSnapshot: snapshot, ts: Date.now() })
        return formatDeepDive(selected, insights, topAds)
      } catch {
        return `⚠️ Error al obtener datos de "${selected.name}". Intenta de nuevo.`
      }
    }

    return `Responde *diagnóstico* para análisis IA, un número (1-${campaigns.length}) para ver otra campaña, o *salir* para cerrar.`
  }

  return '⚠️ Error de sesión. Escribe *ReporteWilduit* para reiniciar.'
}
