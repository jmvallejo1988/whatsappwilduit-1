export type BotConfig = {
  active: boolean
  maxMessages: number
  handoffMessage: string
  systemPrompt: string
}

export const DEFAULT_BOT_CONFIG: BotConfig = {
  active: true,
  maxMessages: 6,
  handoffMessage:
    '¡Perfecto! Ya tengo todo lo que necesito 🙌 Un asesor de Wilduit Marketing te va a escribir pronto para coordinar tu Diagnóstico. ¡Que tengas excelente día!',
  systemPrompt: `Eres el asistente de ventas de Wilduit Boost Digital, representando al Mgtr. Jonathan Vallejo.

PERSONALIDAD
- Tono cálido, directo y profesional — nunca robótico ni sobre-formal
- Tuteas al prospecto con naturalidad
- Máximo 3 líneas por mensaje, 1 sola pregunta a la vez
- Emojis con moderación (1-2 por mensaje máx)

OBJETIVO
Calificar al prospecto de forma natural y guiarlo a agendar el Diagnóstico de Autoridad 360° ($45 USD):
https://calendar.app.google/KKVFQ5xXekyhEDYT8

El diagnóstico es el PRIMER PASO antes de cualquier servicio — auditoría 1 a 1, en 48h reciben Hoja de Ruta real para su negocio. Nunca lo presentes como una venta directa.

CÓMO CONVERSAR
- Si el primer mensaje es un saludo simple, responde calurosamente y pregunta qué tipo de negocio tienen
- Adapta cada respuesta al contexto — no sigas un guión fijo
- Califica de forma conversacional: qué venden, si ya invirtieron en publicidad, qué resultados buscan
- Con 2-3 respuestas del prospecto ya tienes contexto para presentar el Diagnóstico como siguiente paso lógico
- Si preguntan por precios o servicios, explica que el diagnóstico es el paso previo para saber exactamente qué necesitan
- Si quieren agendar, da el link: https://calendar.app.google/KKVFQ5xXekyhEDYT8

LÍMITES
- No inventes precios de otros servicios
- No hagas promesas de resultados específicos
- Si es muy técnico o fuera de tu alcance, di que un asesor los contactará`,
}

type Message = { role: 'user' | 'assistant' | 'system'; content: string }

function mergeConsecutiveRoles(messages: Message[]): Message[] {
  const merged: Message[] = []
  for (const msg of messages) {
    const last = merged[merged.length - 1]
    if (last && last.role === msg.role) {
      last.content += '\n' + msg.content
    } else {
      merged.push({ ...msg })
    }
  }
  return merged
}

export async function callOpenRouter(
  messages: Message[],
  systemPrompt: string,
  model?: string
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set')

  const allMessages: Message[] = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ]

  const merged = mergeConsecutiveRoles(allMessages)

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://whatsappwilduit-1.vercel.app',
      'X-Title': 'Wilduit WA Manager',
    },
    body: JSON.stringify({
      model: model || process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
      messages: merged,
      max_tokens: 200,
      temperature: 0.7,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenRouter error ${res.status}: ${err}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() || ''
}

export async function callOpenRouterLong(
  prompt: string,
  systemPrompt: string
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set')

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://whatsappwilduit-1.vercel.app',
      'X-Title': 'Wilduit WA Manager',
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      max_tokens: 600,
      temperature: 0.5,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenRouter error ${res.status}: ${err}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() || ''
}
