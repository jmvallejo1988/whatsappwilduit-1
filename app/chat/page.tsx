'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'

type Conversation = {
  phone: string | number
  name?: string | number
  lastMessage?: string
  lastTimestamp?: number
  ts?: number
}

type Label = {
  id: string
  name: string
  color: string
}

export default function ChatListPage() {
  const [convos, setConvos] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [labels, setLabels] = useState<Label[]>([])
  const [chatLabels, setChatLabels] = useState<Record<string, string[]>>({})

  const load = useCallback(async (silent = false) => {
    try {
      const data = await fetch('/api/conversations').then(r => r.json())
      const raw: Conversation[] = data.conversations || []
      let items: Conversation[]
      if (raw.length > 0 && typeof raw[0] === 'object' && 'phone' in raw[0]) {
        items = raw.map(c => ({
          phone: String(c.phone),
          name: c.name,
          lastMessage: c.lastMessage || '',
          ts: c.lastTimestamp || 0,
        }))
      } else {
        const phones = raw.map(c => typeof c === 'string' ? c : String((c as { phone: string }).phone))
        items = await Promise.all(
          phones.map(async (phone) => {
            try {
              const msgs = await fetch('/api/messages?phone=' + phone).then(r => r.json())
              const last = msgs.messages?.[msgs.messages.length - 1]
              const text = last?.text || last?.content || ''
              return { phone, lastMessage: text.slice(0, 60), ts: last?.timestamp || last?.ts || 0 }
            } catch {
              return { phone, lastMessage: '', ts: 0 }
            }
          })
        )
      }
      items.sort((a, b) => (b.ts || 0) - (a.ts || 0))
      setConvos(items)
      const labelsData = await fetch('/api/labels').then(r => r.json())
      setLabels(labelsData.labels || [])
      const chatLabelsMap: Record<string, string[]> = {}
      await Promise.all(
        items.map(async (c) => {
          const phone = String(c.phone)
          const ld = await fetch('/api/labels?phone=' + phone).then(r => r.json())
          chatLabelsMap[phone] = ld.chatLabels || []
        })
      )
      setChatLabels(chatLabelsMap)
      if (!silent) setLoading(false)
    } catch {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(false)
    const interval = setInterval(() => load(true), 10000)
    return () => clearInterval(interval)
  }, [load])

  const getLabelById = (id: string) => labels.find(l => l.id === id)

  return (
    <AppShell activeTab="chats">
      <div style={{ padding: '8px 0' }}>
        {loading && (
          <p style={{ color: '#555', fontSize: 13, textAlign: 'center', marginTop: 40 }}>Cargando...</p>
        )}
        {!loading && convos.length === 0 && (
          <p style={{ color: '#555', fontSize: 13, textAlign: 'center', marginTop: 40 }}>Sin conversaciones.</p>
        )}
        {convos.map((c) => {
          const phone = String(c.phone)
          const ts = c.ts || 0
          const timeStr = ts ? new Date(ts).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }) : ''
          const assignedLabels = (chatLabels[phone] || []).map(id => getLabelById(id)).filter(Boolean) as Label[]
          return (
            <Link key={phone} href={'/chat/' + phone} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#1a1a1a', padding: '12px 16px', textDecoration: 'none', color: '#fff', borderBottom: '1px solid #222' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#1e3a2a', color: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, flexShrink: 0 }}>
                {phone.slice(-2)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>+{phone}</span>
                  {assignedLabels.map(l => (
                    <span key={l.id} style={{ background: l.color + '33', color: l.color, border: '1px solid ' + l.color + '55', borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 600 }}>{l.name}</span>
                  ))}
                </div>
                <div style={{ color: '#666', fontSize: 12, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  {c.lastMessage || 'Sin mensajes'}
                </div>
              </div>
              {timeStr && <div style={{ color: '#444', fontSize: 11, flexShrink: 0 }}>{timeStr}</div>}
            </Link>
          )
        })}
      </div>
    </AppShell>
  )
}
