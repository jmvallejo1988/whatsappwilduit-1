import { Redis } from '@upstash/redis'
import { kv } from '@vercel/kv'

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || ''
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || ''

const redis = new Redis({ url, token })
export default redis

interface Message {
  role: string
  content: string
  ts: number
}

interface ConversationRecord extends Record<string, unknown> {
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

export async function saveConversationMeta(
  phone: string,
  name: string,
  lastMessage: string
): Promise<void> {
  try {
    const now = Date.now()
    await Promise.all([
      kv.hset(`conversation:${phone}`, {
        phone,
        name: name || String(phone),
        lastMessage: lastMessage.substring(0, 80),
        lastTimestamp: now,
      }),
      kv.zadd('conversations', { score: now, member: String(phone) }),
    ])
  } catch (e) {
    console.error('saveConversationMeta error:', e)
  }
}

export async function getMessages(phone: string): Promise<Message[]> {
  try {
    const raw = await redis.lrange(`messages:${phone}`, 0, 99)
    return (raw as Array<unknown>).map((r) => {
      // @upstash/redis auto-deserializes JSON — r may already be an object
      if (typeof r === 'object' && r !== null) return r as Message
      if (typeof r === 'string') { try { return JSON.parse(r) } catch { return null } }
      return null
    }).filter(Boolean).reverse() as Message[]
  } catch (e) { console.error('getMessages error:', e); return [] }
}

export async function saveOutboundMessage(
  phone: string,
  name: string,
  text: string
): Promise<void> {
  try {
    const msg = JSON.stringify({ role: 'assistant', content: text, ts: Date.now() })
    await redis.lpush(`messages:${phone}`, msg)
    await saveConversationMeta(phone, name || phone, text)
  } catch (e) {
    console.error('saveOutboundMessage error:', e)
  }
}
