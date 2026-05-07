import redis from './redis'
import { DEFAULT_BOT_CONFIG, BotConfig } from './openrouter'

const CONFIG_KEY = 'bot:config'

export async function getBotConfig(): Promise<BotConfig> {
  try {
    const saved = await redis.get<BotConfig>(CONFIG_KEY)
    if (saved) return { ...DEFAULT_BOT_CONFIG, ...saved }
  } catch {}
  return DEFAULT_BOT_CONFIG
}

export async function setBotConfig(config: Partial<BotConfig>): Promise<void> {
  const current = await getBotConfig()
  await redis.set(CONFIG_KEY, { ...current, ...config })
}

export async function isBotActive(phone: string): Promise<{ active: boolean; reason: string; count: number }> {
  const config = await getBotConfig()
  if (!config.active) return { active: false, reason: 'bot desactivado globalmente', count: 0 }

  const humanMode = await redis.get<boolean>(`bot:human:${phone}`)
  if (humanMode) return { active: false, reason: 'operador humano activo', count: 0 }

  const count = (await redis.get<number>(`bot:count:${phone}`)) ?? 0
  if (count >= config.maxMessages) return { active: false, reason: `límite de ${config.maxMessages} mensajes alcanzado`, count }

  const key = process.env.OPENROUTER_API_KEY
  if (!key) return { active: false, reason: 'OPENROUTER_API_KEY no configurada', count }

  return { active: true, reason: 'OK — bot deberia activarse', count }
}

export async function incrementBotCount(phone: string): Promise<number> {
  const key = `bot:count:${phone}`
  const count = await redis.incr(key)
  return count
}

export async function getBotCount(phone: string): Promise<number> {
  return (await redis.get<number>(`bot:count:${phone}`)) ?? 0
}

export async function setHumanMode(phone: string, active: boolean): Promise<void> {
  if (active) {
    await redis.set(`bot:human:${phone}`, true)
  } else {
    await redis.del(`bot:human:${phone}`)
  }
}

// Alias for backward compatibility
export async function activateHumanMode(phone: string): Promise<void> {
  await setHumanMode(phone, true)
}

export async function getConversationMode(phone: string): Promise<boolean> {
  return (await redis.get<boolean>(`bot:human:${phone}`)) ?? false
}

export async function resetPhone(phone: string): Promise<void> {
  await redis.del(`bot:human:${phone}`)
  await redis.del(`bot:count:${phone}`)
}

export async function saveMessage(phone: string, role: 'user' | 'assistant', content: string): Promise<void> {
  const key = `messages:${phone}`
  const msg = { role, content, ts: Date.now() }
  await redis.lpush(key, JSON.stringify(msg))
  await redis.ltrim(key, 0, 49)
}

// Aliases for backward compatibility
export async function saveInboundMessage(phone: string, content: string): Promise<void> {
  await saveMessage(phone, 'user', content)
}

export async function saveOutboundMessage(phone: string, content: string): Promise<void> {
  await saveMessage(phone, 'assistant', content)
}

export async function getMessages(phone: string): Promise<Array<{ role: string; content: string; ts: number }>> {
  const key = `messages:${phone}`
  const raw = await redis.lrange<string>(key, 0, -1)
  return raw
    .map((r) => {
      try { return typeof r === 'string' ? JSON.parse(r) : r } catch { return null }
    })
    .filter(Boolean)
    .reverse()
}

export async function getConversations(): Promise<string[]> {
  const keys = await redis.keys('messages:*')
  return keys.map((k: string) => k.replace('messages:', ''))
}
