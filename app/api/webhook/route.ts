import { NextRequest, NextResponse } from 'next/server'
import {
  getBotConfig,
  isBotActive,
  incrementBotCount,
  setHumanMode,
  saveMessage,
  getMessages,
} from '@/lib/bot'
import { callOpenRouter } from '@/lib/openrouter'
import { sendTextMessage } from '@/lib/whatsapp'
import {
  isMetricsTrigger,
  hasActiveMetricsSession,
  handleMetricsMessage,
} from '@/lib/metrics-handler'
import { saveConversationMeta } from '@/lib/redis'

// ── GET: Webhook verification ─────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// ── POST: Incoming messages ───────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  const entry = (body as { entry?: unknown[] })?.entry?.[0]
  const change = (entry as { changes?: unknown[] })?.changes?.[0]
  const value = (change as { value?: unknown })?.value as {
    messages?: Array<{
      from: string
      type: string
      text?: { body: string }
      id: string
    }>
    contacts?: Array<{ profile: { name: string }; wa_id: string }>
    statuses?: unknown[]
  }

  // Ignore status updates
  if (!value?.messages?.length) {
    return NextResponse.json({ status: 'ok' })
  }

  const msg = value.messages[0]
  if (msg.type !== 'text') return NextResponse.json({ status: 'ok' })

  const phone = msg.from
  const text = msg.text?.body?.trim() || ''
  const contactName = value.contacts?.[0]?.profile?.name || phone

  console.log(`WEBHOOK_MSG phone=${phone} text="${text.slice(0, 80)}"`)

  // ── METRICS INTERCEPTOR ───────────────────────────────────────────────────
  const METRICS_ALLOWED = (
    process.env.METRICS_ALLOWED_PHONES || '593963018853,593989131972'
  ).split(',').map((p) => p.trim())

  const isAllowedForMetrics = METRICS_ALLOWED.includes(phone)

  const triggerMetrics = isAllowedForMetrics && isMetricsTrigger(text)
  const activeSession = isAllowedForMetrics && (await hasActiveMetricsSession(phone))

  if (triggerMetrics || activeSession) {
    console.log(`METRICS_FLOW phone=${phone} trigger=${triggerMetrics} session=${activeSession}`)
    try {
      const reply = await handleMetricsMessage(phone, text)
      if (reply) {
        await sendTextMessage(phone, reply)
        console.log(`METRICS_SENT phone=${phone}`)
      }
    } catch (err) {
      console.error(`METRICS_ERROR phone=${phone}`, err)
      await sendTextMessage(
        phone,
        '⚠️ Error al procesar las métricas. Intenta de nuevo en unos segundos.'
      ).catch(() => {})
    }
    return NextResponse.json({ status: 'ok' })
  }

  // ── SALES BOT FLOW ─────────────────────────────────────────────────────────
  const config = await getBotConfig()
  const { active, reason, count } = await isBotActive(phone)

  console.log(`BOT_CHECK phone=${phone} active=${active} reason="${reason}" count=${count}`)

  // Save incoming message and update conversations list
  await saveMessage(phone, 'user', text)
  await saveConversationMeta(phone, contactName, text)

  if (!active) {
    console.log(`BOT_SKIP phone=${phone} reason="${reason}"`)
    if (reason.includes('límite')) {
      await sendTextMessage(phone, config.handoffMessage).catch(() => {})
    }
    return NextResponse.json({ status: 'ok' })
  }

  // Generate bot response
  console.log(`BOT_GENERATING phone=${phone}`)
  try {
    const history = await getMessages(phone)
    const messages = history.slice(-10).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

    const reply = await callOpenRouter(messages, config.systemPrompt)
    await saveMessage(phone, 'assistant', reply)
    await incrementBotCount(phone)
    await sendTextMessage(phone, reply)
    console.log(`BOT_SENT phone=${phone}`)

    const newCount = count + 1
    if (newCount >= config.maxMessages) {
      await sendTextMessage(phone, config.handoffMessage).catch(() => {})
      await setHumanMode(phone, true)
      console.log(`BOT_HANDOFF phone=${phone}`)
    }
  } catch (err) {
    console.error(`BOT_ERROR phone=${phone}`, err)
  }

  return NextResponse.json({ status: 'ok' })
}
