import { Redis } from '@upstash/redis'
import { kv } from '@vercel/kv'

// KV_REST_API_URL is https:// (Upstash REST) — preferred over REDIS_URL (rediss://)
const url =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL ||
  ''

const token =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  ''

const redis = new Redis({ url, token })

export default redis

// ── Compatibility exports (legacy route files import from here) ───────────────

interface ConversationRecord {
  phone: string
  name: string
  lastMessage: string
  lastTimestamp: number
}

export async function getConversations(): Promise<ConversationRecord[]> {
  try {
    const phones = await kv.zrange<string[]>('conversations', 0, -1, { rev: true })
    if (!phones?.length) return []
    const convs = await Promise.all(
      phones.map((p) => kv.hgetall<ConversationRecord>(`conversation:${p}`))
    )
    return convs.filter(Boolean) as ConversationRecord[]
  } catch {
    return []
  }
}

export async function getMessages(
  phone: string
): Promise<Array<{ role: string; content: string; ts: number; id?: string }>> {
  try {
    const raw = await redis.lrange<string>(`messages:${phone}`, 0, -1)
    return raw
      .map((r) => {
        try { return typeof r === 'string' ? JSON.parse(r) : r } catch { return null }
      })
      .filter(Boolean)
      .reverse() as Array<{ role: string; content: string; ts: number; id?: string }>
  } catch {
    return []
  }
}

export async function saveOutboundMessage(
  phone: string,
  text: string,
  tempId?: string
): Promise<{ role: string; content: string; ts: number; id: string }> {
  const ts = Date.now()
  const id = tempId || `out_${ts}`
  const msg = { role: 'assistant' as const, content: text, ts, id }
  await redis.lpush(`messages:${phone}`, JSON.stringify(msg))
  await redis.ltrim(`messages:${phone}`, 0, 49)
  return msg
}
