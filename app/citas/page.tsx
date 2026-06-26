'use client'
import { useEffect, useState, useCallback } from 'react'
import AppShell from '@/components/AppShell'

type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'

type Appointment = {
  id: string
  phone: string
  name: string
  service: string
  datetime: string
  status: AppointmentStatus
  gcal_event_id?: string
  notes?: string
  created_at: string
}

const STATUS_CONFIG: Record<AppointmentStatus, { label: string; color: string; bg: string }> = {
  pending:   { label: 'Pendiente',  color: '#f59e0b', bg: '#f59e0b22' },
  confirmed: { label: 'Confirmada', color: '#22c55e', bg: '#22c55e22' },
  cancelled: { label: 'Cancelada',  color: '#ef4444', bg: '#ef444422' },
  completed: { label: 'Completada', color: '#3b82f6', bg: '#3b82f622' },
  no_show:   { label: 'No asistió', color: '#888',    bg: '#88888822' },
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('es-EC', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone: 'America/Guayaquil',
  })
}

const s = {
  card: {
    background: '#1a1a1a',
    border: '1px solid #222',
    borderRadius: 12,
    padding: '14px 16px',
    marginBottom: 10,
    cursor: 'pointer',
  } as React.CSSProperties,
  badge: (st: AppointmentStatus) => ({
    background: STATUS_CONFIG[st].bg,
    color: STATUS_CONFIG[st].color,
    border: `1px solid ${STATUS_CONFIG[st].color}44`,
    borderRadius: 20,
    padding: '2px 10px',
    fontSize: 11,
    fontWeight: 600,
  } as React.CSSProperties),
  btn: {
    background: '#25D366',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '9px 16px',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
  } as React.CSSProperties,
  btnSm: (color: string) => ({
    background: color + '22',
    color,
    border: `1px solid ${color}44`,
    borderRadius: 6,
    padding: '5px 10px',
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 600,
  } as React.CSSProperties),
}

export default function CitasPage() {
  const [appts, setAppts] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<AppointmentStatus | 'all'>('all')
  const [selected, setSelected] = useState<Appointment | null>(null)
  const [updating, setUpdating] = useState(false)

  const load = useCallback(async () => {
    try {
      const from = new Date(Date.now() - 7 * 86400_000).toISOString()
      const to = new Date(Date.now() + 30 * 86400_000).toISOString()
      const data = await fetch(`/api/appointments?from=${from}&to=${to}`).then(r => r.json())
      setAppts(data.appointments || [])
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function updateStatus(id: string, status: AppointmentStatus) {
    setUpdating(true)
    await fetch(`/api/appointments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    await load()
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : null)
    setUpdating(false)
  }

  async function deleteAppt(id: string) {
    if (!confirm('¿Eliminar esta cita?')) return
    await fetch(`/api/appointments/${id}`, { method: 'DELETE' })
    setSelected(null)
    await load()
  }

  const filtered = filter === 'all' ? appts : appts.filter(a => a.status === filter)
  const upcoming = filtered.filter(a => new Date(a.datetime) >= new Date())
  const past = filtered.filter(a => new Date(a.datetime) < new Date())

  const tabs: Array<AppointmentStatus | 'all'> = ['all', 'pending', 'confirmed', 'completed', 'cancelled']

  return (
    <AppShell activeTab="citas">
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '16px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#fff' }}>📅 Citas</h1>
          <a href="/citas/nueva" style={s.btn}>+ Nueva cita</a>
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              style={{
                background: filter === tab ? '#0d2a1e' : '#1a1a1a',
                color: filter === tab ? '#25D366' : '#666',
                border: `1px solid ${filter === tab ? '#25D36644' : '#333'}`,
                borderRadius: 20,
                padding: '5px 14px',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {tab === 'all' ? 'Todas' : STATUS_CONFIG[tab].label}
            </button>
          ))}
        </div>

        {loading && (
          <p style={{ color: '#555', fontSize: 13, textAlign: 'center', marginTop: 40 }}>Cargando citas...</p>
        )}

        {/* Appointment list */}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: 60, color: '#444' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <p style={{ fontSize: 14 }}>No hay citas en este rango.</p>
            <a href="/citas/nueva" style={{ ...s.btn, display: 'inline-block', textDecoration: 'none', marginTop: 8 }}>
              + Crear primera cita
            </a>
          </div>
        )}

        {upcoming.length > 0 && (
          <>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>
              Próximas ({upcoming.length})
            </p>
            {upcoming.map(appt => (
              <AppointmentCard key={appt.id} appt={appt} onClick={() => setSelected(appt)} />
            ))}
          </>
        )}

        {past.length > 0 && (
          <>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '16px 0 8px' }}>
              Pasadas ({past.length})
            </p>
            {past.map(appt => (
              <AppointmentCard key={appt.id} appt={appt} onClick={() => setSelected(appt)} dimmed />
            ))}
          </>
        )}
      </div>

      {/* Detail drawer */}
      {selected && (
        <div
          style={{ position: 'fixed', inset: 0, background: '#00000088', zIndex: 50, display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setSelected(null)}
        >
          <div
            style={{ background: '#111', width: '100%', maxHeight: '85vh', overflowY: 'auto', borderRadius: '20px 20px 0 0', padding: 20 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: 40, height: 4, background: '#333', borderRadius: 2, margin: '0 auto 20px' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: '0 0 4px', fontSize: 18, color: '#fff' }}>{selected.name}</h2>
                <p style={{ margin: 0, color: '#25D366', fontSize: 13 }}>+{selected.phone}</p>
              </div>
              <span style={s.badge(selected.status)}>{STATUS_CONFIG[selected.status].label}</span>
            </div>

            <div style={{ background: '#1a1a1a', borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <Row icon="🛠" label="Servicio" value={selected.service} />
              <Row icon="📅" label="Fecha y hora" value={formatDateTime(selected.datetime)} />
              {selected.notes && <Row icon="📝" label="Notas" value={selected.notes} />}
              {selected.gcal_event_id && (
                <Row icon="🗓" label="Google Calendar" value="Sincronizado ✓" valueColor="#22c55e" />
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {selected.status === 'pending' && (
                <>
                  <button
                    onClick={() => updateStatus(selected.id, 'confirmed')}
                    disabled={updating}
                    style={s.btnSm('#22c55e')}
                  >✓ Confirmar</button>
                  <button
                    onClick={() => updateStatus(selected.id, 'cancelled')}
                    disabled={updating}
                    style={s.btnSm('#ef4444')}
                  >✕ Cancelar</button>
                </>
              )}
              {selected.status === 'confirmed' && (
                <>
                  <button
                    onClick={() => updateStatus(selected.id, 'completed')}
                    disabled={updating}
                    style={s.btnSm('#3b82f6')}
                  >✓ Completada</button>
                  <button
                    onClick={() => updateStatus(selected.id, 'cancelled')}
                    disabled={updating}
                    style={s.btnSm('#ef4444')}
                  >✕ Cancelar</button>
                </>
              )}
              <a
                href={`/chat/${selected.phone}`}
                style={{ ...s.btnSm('#25D366'), textDecoration: 'none' }}
              >
                💬 Abrir chat
              </a>
            </div>

            <button
              onClick={() => deleteAppt(selected.id)}
              style={{ ...s.btnSm('#ef4444'), width: '100%', textAlign: 'center' }}
            >
              🗑 Eliminar cita
            </button>
          </div>
        </div>
      )}
    </AppShell>
  )
}

function AppointmentCard({
  appt, onClick, dimmed,
}: { appt: Appointment; onClick: () => void; dimmed?: boolean }) {
  return (
    <div onClick={onClick} style={{ ...s.card, opacity: dimmed ? 0.6 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>{appt.name}</span>
            {appt.gcal_event_id && <span style={{ fontSize: 10, color: '#22c55e' }}>🗓</span>}
          </div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{appt.service}</div>
          <div style={{ fontSize: 12, color: '#25D366' }}>{formatDateTime(appt.datetime)}</div>
        </div>
        <span style={s.badge(appt.status)}>{STATUS_CONFIG[appt.status].label}</span>
      </div>
    </div>
  )
}

function Row({ icon, label, value, valueColor }: { icon: string; label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
      <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 10, color: '#555', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
        <div style={{ fontSize: 13, color: valueColor ?? '#e0e0e0', marginTop: 2 }}>{value}</div>
      </div>
    </div>
  )
}
