'use client'
import { useEffect, useState, useCallback } from 'react'

type Conversation = {
  phone: string
  name?: string
  lastMessage?: string
  lastTimestamp?: number
  ts?: number
}

export default function ChatListPage() {
  const [convos, setConvos] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (silent = false) => {
    try {
      const data = await fetch('/api/conversations').then(r => r.json())
      const raw: Conversation[] = data.conversations || []

      let items: Conversation[]
      if (raw.length > 0 && typeof raw[0] === 'object' && 'phone' in raw[0]) {
        items = raw.map(c => ({
          phone: String(c.phone),
          name: c.name ? String(c.name) : undefined,
          lastMessage: c.lastMessage || '',
          ts: c.lastTimestamp || 0,
        }))
      } else {
        items = (raw as unknown as string[]).map(p => ({ phone: String(p), ts: 0 }))
      }

      items.sort((a, b) => (b.ts || 0) - (a.ts || 0))
      setConvos(items)
      if (!silent) setLoading(false)
    } catch {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(false)
    const interval = setInterval(() => load(true), 8000)
    return () => clearInterval(interval)
  }, [load])

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', background: '#111b21', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: '#202c33', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #2a3942' }}>
        <h1 style={{ color: '#e9edef', fontSize: 20, fontWeight: 600, margin: 0 }}>Wilduit WA Manager</h1>
        <span style={{ color: '#00a884', fontSize: 22 }}>💬</span>
      </div>

      {loading && (
        <p style={{ color: '#8696a0', fontSize: 14, textAlign: 'center', marginTop: 60 }}>Cargando conversaciones...</p>
      )}
      {!loading && convos.length === 0 && (
        <p style={{ color: '#8696a0', fontSize: 14, textAlign: 'center', marginTop: 60 }}>Sin conversaciones aún.</p>
      )}

      {convos.map((c) => {
        const phone = String(c.phone)
        const ts = c.ts || 0
        const timeStr = ts
          ? new Date(ts).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })
          : ''
        return (
          <a
            key={phone}
            href={`/chat/${phone}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '12px 20px',
              textDecoration: 'none',
              color: '#e9edef',
              borderBottom: '1px solid #2a3942',
              background: 'transparent',
            }}
          >
            <div style={{
              width: 46, height: 46, borderRadius: '50%',
              background: '#00a884',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 16, flexShrink: 0, color: '#fff',
            }}>
              {phone.slice(-2)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>+{phone}</div>
              <div style={{ color: '#8696a0', fontSize: 13, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                {c.lastMessage || 'Sin mensajes'}
              </div>
            </div>
            {timeStr && <div style={{ color: '#8696a0', fontSize: 12, flexShrink: 0 }}>{timeStr}</div>}
          </a>
        )
      })}
    </div>
  )
}
