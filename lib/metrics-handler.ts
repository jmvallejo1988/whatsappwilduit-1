/**
 * Metrics Handler — Wilduit
 *
 * State machine for the "Métricas con Wilduit" protocol via WhatsApp.
 *
 * Phases:
 *  0 — no active session (trigger: keyword)
 *  1 — campaign list sent, waiting for selection (1-N) or "todas"
 *  2 — deep dive shown, waiting for "diagnóstico", another number, or "salir"
 */

import redis from './redis'
import {
  AD_ACCOUNTS,
  getActiveCampaigns,
  getAccountOverview,
  getCampaignInsights,
  getTopAds,
  getAccountCampaignsBrief,
  getAllPagesInsights,
  currentMonthRange,
  formatBudget,
  getActionValue,
  objectiveLabel,
  type Campaign,
  type CampaignBrief,
} from './meta-api'
import { callOpenRouterLong } from './openrouter'

// Keywords that trigger the Meta Ads campaign report
export const METRICS_TRIGGERS = [
  'reportewilduit',
  'reporte wilduit',
  'rwilduit',
  'rw',
]

// Keywords that trigger the organic page insights report
export const PAGES_TRIGGERS = [
  'metricaswilduit',
  'metricas wilduit',
  'mwilduit',
]

// Commands within a session
const CMD_EXIT = ['salir', 'exit', 'cerrar', 'fin', 'stop']
const CMD_DIAGNOSIS = ['diagnóstico', 'diagnostico', 'analiza', 'análisis', 'analisis', 'diagnostica']
const CMD_ALL = ['todas', 'all', 'global']
const SESSION_TTL = 60 * 60 * 2 // 2 hours

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
  // Expire stale sessions
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

export function isPagesTrigger(text: string): boolean {
  const lower = text.toLowerCase().trim()
  return PAGES_TRIGGERS.some((t) => lower === t || lower.startsWith(t))
}

export async function hasActiveMetricsSession(phone: string): Promise<boolean> {
  const s = await getSession(phone)
  return s !== null
}

// ── Multi-account condensed report ────────────────────────────────────────────

/** Remove MOFU/TOFU tags, date ranges and budget noise from campaign names */
function cleanName(raw: string): string {
  let n = raw
    .replace(/^[-\s\[\]]+/, '')                                      // leading dashes/brackets
    .replace(/\[?\s*(TOFU|MOFU|BOFU)\s*\]?\s*/gi, '$1 ')           // normalize TOFU/MOFU
    .replace(/\s*(DESDE\s+\d+|\$\d+|=\s*\$).*$/i, '')              // cut at DESDE N or $ amount
    .replace(/\s*\bHASTA\s+\d+\s+\w+\b.*/i, '')                    // cut trailing HASTA date
    .replace(/\s{2,}/g, ' ')
    .trim()
  return n.length > 32 ? n.slice(0, 30) + '…' : n || raw.slice(0, 30)
}

/** Single emoji rating based on CTR and messages */
function ratingEmoji(ctr: number, msgs: number, isMessaging: boolean): string {
  if (isMessaging) {
    if (msgs >= 50) return '🔥'
    if (msgs >= 15) return '✅'
    if (msgs >= 5)  return '📌'
    return '⚠️'
  }
  if (ctr >= 5)  return '🔥'
  if (ctr >= 2)  return '✅'
  if (ctr >= 1)  return '📌'
  return '⚠️'
}

/** Short performance label */
function perfLabel(ctr: number, msgs: number, isMessaging: boolean): string {
  if (isMessaging) {
    if (msgs >= 50) return 'Excelente'
    if (msgs >= 15) return 'Bien'
    if (msgs >= 5)  return 'Regular'
    return 'Bajo — revisar'
  }
  if (ctr >= 5)  return 'CTR excelente'
  if (ctr >= 2)  return 'Buen CTR'
  if (ctr >= 1)  return 'CTR normal'
  return 'CTR bajo — revisar creative'
}

/** Format a single campaign line for the brief report */
function formatCampaignLine(c: CampaignBrief): string {
  const msgs     = parseInt(c.messages || '0')
  const isMsg    = msgs > 0
  const ctr      = parseFloat(c.ctr || '0')
  const reach    = parseInt(c.reach || '0').toLocaleString('es')
  const imp      = parseInt(c.impressions || '0').toLocaleString('es')
  const clicks   = parseInt(c.clicks || '0').toLocaleString('es')
  const rating   = ratingEmoji(ctr, msgs, isMsg)
  const perf     = perfLabel(ctr, msgs, isMsg)
  const name     = cleanName(c.campaign_name)

  let line = `• *${name}*\n`
  line    += `  👁 ${reach} alc · 📣 ${imp} imp · 🖱 ${clicks} clics`
  if (isMsg) line += ` · 💬 ${msgs} msgs`
  line    += `\n  ${rating} ${perf}`
  return line
}

/** Generate the full multi-account condensed report */
async function generateAllAccountsReport(): Promise<string> {
  const { since, until } = currentMonthRange()
  const [sinceDay, sinceMonth] = since.split('-').slice(1)
  const [,, untilDay] = until.split('-')

  const monthNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  const monthLabel = monthNames[parseInt(sinceMonth) - 1]

  const lines: string[] = [
    `📊 *ReporteWilduit* — ${parseInt(sinceDay)} al ${parseInt(untilDay)} ${monthLabel}\n`,
  ]

  const warnings: string[] = []

  const results = await Promise.allSettled(
    AD_ACCOUNTS.map(async (acc) => {
      const campaigns = await getAccountCampaignsBrief(acc.id)
      return { ...acc, campaigns }
    })
  )

  for (let i = 0; i < AD_ACCOUNTS.length; i++) {
    const acc = AD_ACCOUNTS[i]
    const result = results[i]

    if (result.status === 'rejected') {
      lines.push(`${acc.emoji} *${acc.name}*\n⚠️ Error al conectar\n`)
      continue
    }

    const { campaigns } = result.value

    if (campaigns.length === 0) {
      lines.push(`${acc.emoji} *${acc.name}*\nSin actividad este mes\n`)
      continue
    }

    lines.push(`${acc.emoji} *${acc.name}*`)
    for (const c of campaigns) {
      lines.push(formatCampaignLine(c))
      // flag warnings
      const msgs = parseInt(c.messages || '0')
      const ctr  = parseFloat(c.ctr || '0')
      const isMsg = msgs > 0
      if (ratingEmoji(ctr, msgs, isMsg) === '⚠️') {
        warnings.push(`${acc.name}: ${cleanName(c.campaign_name)}`)
      }
    }
    lines.push('')
  }

  if (warnings.length > 0) {
    lines.push(`⚠️ *Revisar:* ${warnings.join(' · ')}`)
  }

  return lines.join('\n').trim()
}

// Format Phase 1 message
function formatPhase1(campaigns: Campaign[], overview: ReturnType<typeof getAccountOverview> extends Promise<infer T> ? T : never): string {
  const lines: string[] = []
  lines.push('📊 *Reporte Wilduit* — Estado actual\n')

  // Daily spend
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
      const budget = c.daily_budget ? `$${(parseInt(c.daily_budget) / 100).toFixed(2)}/día` : c.lifetime_budget ? `$${(parseInt(c.lifetime_budget) / 100).toFixed(2)} total` : '—'
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

// Format Phase 2 deep dive message
function formatDeepDive(campaign: Campaign, insights: Awaited<ReturnType<typeof getCampaignInsights>>, topAds: Awaited<ReturnType<typeof getTopAds>>): string {
  if (!insights) {
    return `🔍 *${campaign.name}*\n\nSin datos disponibles para los últimos 7 días. La campaña puede estar recién creada o sin impresiones.`
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

// Generate AI diagnosis using OpenRouter
async function generateDiagnosis(campaign: Campaign, insightsText: string): Promise<string> {
  const systemPrompt = `Eres un estratega de marketing digital experto en Meta Ads con la metodología Boost Digital de Wilduit Marketing.

Tu objetivo: Analizar métricas de Meta Ads y proponer acciones inmediatas y específicas.

Estilo de respuesta:
- Tono juvenil, directo, tutea al lector
- Máximo 5 puntos de acción
- Cada punto: diagnóstico + acción específica
- Usa emojis de forma estratégica
- Sin relleno, sin introducciones largas
- Formato para WhatsApp (sin markdown complejo)`

  const userPrompt = `Analiza estas métricas de la campaña "${campaign.name}" (objetivo: ${objectiveLabel(campaign.objective)}) y da un diagnóstico con acciones concretas:

${insightsText}

Benchmarks de referencia:
- CTR saludable: >1% | Excelente: >2%
- CPM aceptable: <$15 | Óptimo: <$8
- Frecuencia: 1.5-3.0 (>5 = fatiga)
- CPC: depende del objetivo y nicho

Proporciona: (1) diagnóstico rápido, (2) 3-5 acciones concretas para optimizar.`

  try {
    const result = await callOpenRouterLong(userPrompt, systemPrompt)
    return `🧠 *Diagnóstico IA — ${campaign.name}*\n\n${result}\n\n_Responde con un número para ver otra campaña o *salir* para cerrar._`
  } catch {
    return '⚠️ Error al generar diagnóstico IA. Intenta de nuevo con *diagnóstico*.'
  }
}

// Main handler — returns the WhatsApp message to send back
export async function handleMetricsMessage(
  phone: string,
  text: string,
  isNewTrigger: boolean
): Promise<string> {
  const lower = text.toLowerCase().trim()

  // EXIT command — always available
  if (CMD_EXIT.some((c) => lower === c)) {
    await clearSession(phone)
    return '✅ Sesión de métricas cerrada. Cuando quieras un nuevo reporte, escribe *ReporteWilduit*.'
  }

  const session = await getSession(phone)

  // ── Phase 0: New trigger → condensed multi-account report ────────────────
  if (isNewTrigger || !session) {
    try {
      const report = await generateAllAccountsReport()
      await clearSession(phone) // one-shot, no session needed
      return report
    } catch (err) {
      console.error('META_API_ERROR', err)
      return '⚠️ Error al conectar con Meta Ads. Verifica que el token esté activo e intenta de nuevo.'
    }
  }

  // ── Phase 1: Waiting for campaign selection ────────────────────────────────
  if (session.phase === 1) {
    const { campaigns } = session

    // "todas" — global account summary
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

    // Parse number selection
    const num = parseInt(lower)
    if (!isNaN(num) && num >= 1 && num <= campaigns.length) {
      const selected = campaigns[num - 1]
      try {
        const [insights, topAds] = await Promise.all([
          getCampaignInsights(selected.id),
          getTopAds(selected.id),
        ])

        // Build a text snapshot for diagnosis later
        const snapshot = insights
          ? `Spend: $${insights.spend} | Reach: ${insights.reach} | Impressions: ${insights.impressions} | Clicks: ${insights.clicks} | CTR: ${insights.ctr}% | CPC: $${insights.cpc} | CPM: $${insights.cpm} | Frequency: ${insights.frequency} | Leads: ${getActionValue(insights.actions, 'lead')} | Messages: ${getActionValue(insights.actions, 'onsite_conversion.messaging_conversation_started_7d')}`
          : 'Sin datos'

        const updatedSession: MetricsSession = {
          phase: 2,
          campaigns,
          selectedCampaign: selected,
          insightsSnapshot: snapshot,
          ts: Date.now(),
        }
        await saveSession(phone, updatedSession)

        return formatDeepDive(selected, insights, topAds)
      } catch {
        return `⚠️ Error al obtener datos de "${selected.name}". Intenta de nuevo.`
      }
    }

    return `Responde con el número de la campaña (1-${campaigns.length}), *todas* para resumen global, o *salir* para cerrar.`
  }

  // ── Phase 2: Deep dive shown, waiting for next action ─────────────────────
  if (session.phase === 2) {
    const { campaigns, selectedCampaign, insightsSnapshot } = session

    // Diagnosis request
    if (CMD_DIAGNOSIS.some((c) => lower === c || lower.startsWith(c))) {
      if (!selectedCampaign) return '⚠️ Error de sesión. Escribe *ReporteWilduit* para reiniciar.'
      const diagnosis = await generateDiagnosis(selectedCampaign, insightsSnapshot || 'Sin datos')
      return diagnosis
    }

    // Another campaign number
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

        const updatedSession: MetricsSession = {
          phase: 2,
          campaigns,
          selectedCampaign: selected,
          insightsSnapshot: snapshot,
          ts: Date.now(),
        }
        await saveSession(phone, updatedSession)

        return formatDeepDive(selected, insights, topAds)
      } catch {
        return `⚠️ Error al obtener datos de "${selected.name}". Intenta de nuevo.`
      }
    }

    return `Responde *diagnóstico* para análisis IA, un número (1-${campaigns.length}) para ver otra campaña, o *salir* para cerrar.`
  }

  return '⚠️ Error de sesión. Escribe *ReporteWilduit* para reiniciar.'
}

// ── Page insights report (MetricasWilduit) ────────────────────────────────────

async function generatePagesReport(): Promise<string> {
  const pages = await getAllPagesInsights()

  if (!pages.length) {
    return '⚠️ No se encontraron páginas conectadas al Business Manager. Verifica la configuración en Meta Business Suite.'
  }

  const lines: string[] = ['📱 *MetricasWilduit* — últimos 7 días\n']

  let hasInsights = false

  for (const p of pages) {
    const followers = p.page.fan_count?.toLocaleString('es') ?? '—'
    lines.push(`📄 *${p.page.name}*`)
    lines.push(`  👥 Seguidores: *${followers}*`)

    if (p.error) {
      lines.push(`  ⚠️ ${p.error}`)
    } else {
      hasInsights = true
      const imp   = parseInt(p.impressions_week || '0').toLocaleString('es')
      const eng   = parseInt(p.engaged_users_week || '0').toLocaleString('es')
      const newF  = parseInt(p.new_followers_week || '0').toLocaleString('es')
      const views = parseInt(p.page_views_week || '0').toLocaleString('es')
      lines.push(`  👁 Alcance: *${imp}*`)
      lines.push(`  💬 Interacciones: *${eng}*`)
      lines.push(`  🆕 Nuevos seguidores: *${newF}*`)
      lines.push(`  🔍 Visitas a página: *${views}*`)
    }
    lines.push('')
  }

  if (!hasInsights) {
    lines.push('_Para ver alcance, interacciones y seguidores nuevos, el token de sistema necesita el permiso *read_insights*. Agrégalo en Meta Business Suite → Usuarios del sistema._')
  }

  return lines.join('\n').trim()
}

/** One-shot handler for MetricasWilduit — no session state needed */
export async function handlePagesMessage(phone: string): Promise<string> {
  try {
    console.log(`PAGES_REPORT phone=${phone}`)
    return await generatePagesReport()
  } catch (err) {
    console.error(`PAGES_ERROR phone=${phone}`, err)
    return '⚠️ Error al obtener métricas de páginas. Verifica que el token tenga los permisos necesarios.'
  }
}
