'use client'
import { useState } from 'react'
import AppShell from '@/components/AppShell'

const SERVICES = [
  'Consulta general',
  'Diagnóstico de Autoridad 360°',
  'Estrategia de marca',
  'Sesión de diseño',
  'Revisión de campaña',
  'Reunión de seguimiento',
]

export default function NuevaCitaPage() {
  const [form, setForm] = useState({
    phone: '',
    name: '',
    service: '',
    customService: '',
    date: '',
    time: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const s = {
    section: {
      background: '#1a1a1a',
      borderRadius: 12,
      padding: '16px',
      marginBottom: 14,
      border: '1px solid #222',
    } as React.CSSProperties,
    label: {
      display: 'block',
      fontSize: 11,
      fontWeight: 600,
      color: '#888',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.05em',
      marginBottom: 6,
    },
    input: {
      width: '100%',
      background: '#0a0a0a',
      border: '1px solid #333',
      borderRadius: 8,
      padding: '10px 12px',
      color: '#f0f0f0',
      fontSize: 14,
      outline: 'none',
      boxSizing: 'border-box' as const,
    } as React.CSSProperties,
    btn: {
      background: '#25D366',
      color: '#fff',
      border: 'none',
      borderRadius: 8,
      padding: '12px 20px',
      cursor: 'pointer',
      fontSize: 15,
      fontWeight: 700,
      width: '100%',
    } as React.CSSProperties,
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const phone = form.phone.replace(/\D/g, '')
    if (!phone) return setError('Ingresa el número de WhatsApp')
    if (!form.name.trim()) return setError('Ingresa el nombre del cliente')
    const service = form.service === '__custom__' ? form.customService.trim() : form.service
    if (!service) return setError('Selecciona o ingresa el servicio')
    if (!form.date || !form.time) return setError('Selecciona fecha y hora')

    const datetime = `${form.date}T${form.time}:00`

    setSaving(true)
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, name: form.name.trim(), service, datetime, notes: form.notes.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al crear cita')
      setSuccess(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (success) {
    return (
      <AppShell activeTab="citas" title="Nueva cita" backHref="/citas">
        <div style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 60, marginBottom: 16 }}>✅</div>
          <h2 style={{ color: '#fff', marginBottom: 8 }}>¡Cita creada!</h2>
          <p style={{ color: '#888', fontSize: 14, marginBottom: 24 }}>
            La cita fue registrada y sincronizada con Google Calendar.
            El recordatorio de confirmación se enviará automáticamente 24h antes.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              href="/citas/nueva"
              onClick={() => setSuccess(false)}
              style={{ background: '#1a1a1a', color: '#ccc', border: '1px solid #333', borderRadius: 8, padding: '10px 18px', textDecoration: 'none', fontSize: 14 }}
            >
              + Otra cita
            </a>
            <a
              href="/citas"
              style={{ background: '#25D366', color: '#fff', borderRadius: 8, padding: '10px 18px', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}
            >
              Ver agenda →
            </a>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell activeTab="citas" title="Nueva cita" backHref="/citas">
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '16px' }}>
        <form onSubmit={submit}>

          {/* Cliente */}
          <div style={s.section}>
            <h3 style={{ margin: '0 0 14px', fontSize: 14, color: '#fff', fontWeight: 600 }}>👤 Cliente</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={s.label}>Nombre completo</label>
              <input
                style={s.input}
                placeholder="Ej: María García"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label style={s.label}>WhatsApp (solo números, con código de país)</label>
              <input
                style={s.input}
                placeholder="Ej: 593987654321"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                type="tel"
              />
              <p style={{ margin: '6px 0 0', fontSize: 11, color: '#555' }}>
                Ecuador: 593 + número. Ej: 593987654321
              </p>
            </div>
          </div>

          {/* Servicio */}
          <div style={s.section}>
            <h3 style={{ margin: '0 0 14px', fontSize: 14, color: '#fff', fontWeight: 600 }}>🛠 Servicio</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {SERVICES.map(sv => (
                <label
                  key={sv}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: form.service === sv ? '#0d2a1e' : '#0a0a0a',
                    border: `1px solid ${form.service === sv ? '#25D36666' : '#2a2a2a'}`,
                    borderRadius: 8, padding: '10px 14px', cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="service"
                    value={sv}
                    checked={form.service === sv}
                    onChange={() => setForm(f => ({ ...f, service: sv }))}
                    style={{ accentColor: '#25D366' }}
                  />
                  <span style={{ fontSize: 13, color: '#ddd' }}>{sv}</span>
                </label>
              ))}
              <label
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: form.service === '__custom__' ? '#0d2a1e' : '#0a0a0a',
                  border: `1px solid ${form.service === '__custom__' ? '#25D36666' : '#2a2a2a'}`,
                  borderRadius: 8, padding: '10px 14px', cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="service"
                  value="__custom__"
                  checked={form.service === '__custom__'}
                  onChange={() => setForm(f => ({ ...f, service: '__custom__' }))}
                  style={{ accentColor: '#25D366' }}
                />
                <span style={{ fontSize: 13, color: '#ddd' }}>Otro...</span>
              </label>
              {form.service === '__custom__' && (
                <input
                  style={{ ...s.input, marginTop: 4 }}
                  placeholder="Describe el servicio"
                  value={form.customService}
                  onChange={e => setForm(f => ({ ...f, customService: e.target.value }))}
                  autoFocus
                />
              )}
            </div>
          </div>

          {/* Fecha y hora */}
          <div style={s.section}>
            <h3 style={{ margin: '0 0 14px', fontSize: 14, color: '#fff', fontWeight: 600 }}>📅 Fecha y hora</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={s.label}>Fecha</label>
                <input
                  type="date"
                  style={{ ...s.input, colorScheme: 'dark' }}
                  min={new Date().toISOString().split('T')[0]}
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div>
                <label style={s.label}>Hora</label>
                <input
                  type="time"
                  style={{ ...s.input, colorScheme: 'dark' }}
                  value={form.time}
                  onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Notas */}
          <div style={s.section}>
            <h3 style={{ margin: '0 0 14px', fontSize: 14, color: '#fff', fontWeight: 600 }}>📝 Notas (opcional)</h3>
            <textarea
              rows={3}
              style={{ ...s.input, resize: 'vertical', fontFamily: 'inherit' }}
              placeholder="Información adicional para la cita..."
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>

          {error && (
            <div style={{ background: '#ef444422', border: '1px solid #ef444444', borderRadius: 8, padding: '10px 14px', marginBottom: 12, color: '#ef4444', fontSize: 13 }}>
              ⚠️ {error}
            </div>
          )}

          <button type="submit" disabled={saving} style={{ ...s.btn, opacity: saving ? 0.7 : 1 }}>
            {saving ? '⏳ Creando cita...' : '✅ Crear cita'}
          </button>
        </form>
      </div>
    </AppShell>
  )
}
