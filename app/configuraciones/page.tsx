'use client'
import { useEffect, useState } from 'react'
import AppShell from '@/components/AppShell'

type Label = { id: string; name: string; color: string }
type TemplateType = 'confirm' | 'reminder' | 'post'
type Templates = Record<TemplateType, string>
type BotConfig = {
  active: boolean
  maxMessages: number
  handoffMessage: string
  systemPrompt: string
  phoneNumberId?: string
}
type AppUser = { email: string; role: 'admin' | 'user'; createdAt: string }

const LABEL_COLORS = ['#25D366', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#10b981']

export default function ConfiguracionesPage() {
  const [config, setConfig] = useState<BotConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [labels, setLabels] = useState<Label[]>([])
  const [newLabelName, setNewLabelName] = useState('')
  const [newLabelColor, setNewLabelColor] = useState('#25D366')
  const [creatingLabel, setCreatingLabel] = useState(false)
  const [aiImproving, setAiImproving] = useState(false)
  const [aiInstructions, setAiInstructions] = useState('')
  const [activeSection, setActiveSection] = useState<'bot' | 'etiquetas' | 'plantillas' | 'usuarios'>('bot')
  const [templates, setTemplates] = useState<Templates | null>(null)
  const [savingTpl, setSavingTpl] = useState<TemplateType | null>(null)
  const [savedTpl, setSavedTpl] = useState<TemplateType | null>(null)
  const [users, setUsers] = useState<AppUser[]>([])
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [newUserRole, setNewUserRole] = useState<'admin' | 'user'>('user')
  const [creatingUser, setCreatingUser] = useState(false)
  const [userError, setUserError] = useState('')

  useEffect(() => {
    fetch('/api/bot').then(r => r.json()).then(d => setConfig(d.config))
    fetch('/api/labels').then(r => r.json()).then(d => setLabels(d.labels || []))
    fetch('/api/templates').then(r => r.json()).then(d => setTemplates(d.templates || null))
    fetch('/api/users').then(r => r.json()).then(d => setUsers(d.users || []))
  }, [])

  async function saveTemplate(type: TemplateType) {
    if (!templates) return
    setSavingTpl(type)
    await fetch('/api/templates', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, body: templates[type] }),
    })
    setSavedTpl(type)
    setTimeout(() => setSavedTpl(null), 2500)
    setSavingTpl(null)
  }

  async function saveConfig() {
    if (!config) return
    setSaving(true)
    setSaved(false)
    try {
      await fetch('/api/bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  async function improvePromptWithAI() {
    if (!config || !aiInstructions.trim()) return
    setAiImproving(true)
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENROUTER_KEY || ''}`,
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'Eres un experto en redactar prompts de sistema para bots de ventas por WhatsApp. Mejora el prompt dado según las instrucciones del usuario. Devuelve SOLO el prompt mejorado, sin explicaciones ni comentarios.',
            },
            {
              role: 'user',
              content: `Prompt actual:\n${config.systemPrompt}\n\nInstrucciones de mejora:\n${aiInstructions}`,
            },
          ],
          max_tokens: 800,
        }),
      })
      const data = await res.json()
      const improved = data.choices?.[0]?.message?.content
      if (improved) {
        setConfig(c => c ? { ...c, systemPrompt: improved } : c)
        setAiInstructions('')
      }
    } catch (e) {
      alert('Error al mejorar el prompt con IA')
    } finally {
      setAiImproving(false)
    }
  }

  async function createLabel() {
    if (!newLabelName.trim()) return
    setCreatingLabel(true)
    try {
      const res = await fetch('/api/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', name: newLabelName, color: newLabelColor }),
      })
      const data = await res.json()
      setLabels(data.labels || [])
      setNewLabelName('')
    } finally {
      setCreatingLabel(false)
    }
  }

  async function createAppUser() {
    if (!newUserEmail.trim() || !newUserPassword.trim()) return
    setCreatingUser(true)
    setUserError('')
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newUserEmail.trim(), password: newUserPassword, role: newUserRole }),
      })
      const data = await res.json()
      if (!res.ok) {
        setUserError(data.error || 'Error al crear usuario')
        return
      }
      setNewUserEmail('')
      setNewUserPassword('')
      setNewUserRole('user')
      const updated = await fetch('/api/users').then(r => r.json())
      setUsers(updated.users || [])
    } finally {
      setCreatingUser(false)
    }
  }

  async function deleteAppUser(email: string) {
    if (!confirm(`¿Eliminar acceso de ${email}?`)) return
    await fetch('/api/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const updated = await fetch('/api/users').then(r => r.json())
    setUsers(updated.users || [])
  }

  async function deleteLabel(id: string) {
    const res = await fetch('/api/labels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', labelId: id }),
    })
    const data = await res.json()
    setLabels(data.labels || [])
  }

  const s = {
    section: {
      background: '#1a1a1a',
      borderRadius: 12,
      padding: '16px',
      marginBottom: 16,
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
      padding: '9px 12px',
      color: '#f0f0f0',
      fontSize: 14,
      outline: 'none',
    } as React.CSSProperties,
    textarea: {
      width: '100%',
      background: '#0a0a0a',
      border: '1px solid #333',
      borderRadius: 8,
      padding: '9px 12px',
      color: '#f0f0f0',
      fontSize: 13,
      outline: 'none',
      resize: 'vertical' as const,
      fontFamily: 'inherit',
      lineHeight: 1.5,
    } as React.CSSProperties,
    btnPrimary: {
      background: '#25D366',
      color: '#fff',
      border: 'none',
      borderRadius: 8,
      padding: '9px 18px',
      cursor: 'pointer',
      fontSize: 14,
      fontWeight: 600,
    } as React.CSSProperties,
    btnSecondary: {
      background: '#2a2a2a',
      color: '#ccc',
      border: '1px solid #333',
      borderRadius: 8,
      padding: '9px 18px',
      cursor: 'pointer',
      fontSize: 14,
      fontWeight: 600,
    } as React.CSSProperties,
  }

  return (
    <AppShell activeTab="configuraciones">
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '16px' }}>

        {/* Section tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {(['bot', 'etiquetas', 'plantillas', 'usuarios'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveSection(tab)}
              style={{
                ...s.btnSecondary,
                background: activeSection === tab ? '#0d2a1e' : '#1a1a1a',
                color: activeSection === tab ? '#25D366' : '#888',
                border: activeSection === tab ? '1px solid #25D36644' : '1px solid #222',
              }}
            >
              {tab === 'bot' ? '🤖 Bot IA' : tab === 'etiquetas' ? '🏷️ Etiquetas' : tab === 'plantillas' ? '✉️ Plantillas' : '👥 Usuarios'}
            </button>
          ))}
        </div>

        {/* BOT SECTION */}
        {activeSection === 'bot' && config && (
          <>
            {/* Phone Number ID */}
            <div style={s.section}>
              <h3 style={{ margin: '0 0 14px', fontSize: 14, color: '#fff', fontWeight: 600 }}>
                📱 Número de WhatsApp API
              </h3>
              <label style={s.label}>Phone Number ID (Meta)</label>
              <input
                style={s.input}
                value={config.phoneNumberId || ''}
                onChange={e => setConfig(c => c ? { ...c, phoneNumberId: e.target.value } : c)}
                placeholder="Ej: 123456789012345"
              />
              <p style={{ margin: '8px 0 0', fontSize: 11, color: '#555' }}>
                Encuéntralo en Meta Business → WhatsApp → Configuración del teléfono
              </p>
            </div>

            {/* Bot settings */}
            <div style={s.section}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 14, color: '#fff', fontWeight: 600 }}>🤖 Configuración del Bot</h3>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <span style={{ fontSize: 12, color: '#888' }}>Bot activo</span>
                  <div
                    onClick={() => setConfig(c => c ? { ...c, active: !c.active } : c)}
                    style={{
                      width: 40, height: 22, borderRadius: 11,
                      background: config.active ? '#25D366' : '#333',
                      position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: 3, left: config.active ? 21 : 3,
                      width: 16, height: 16, borderRadius: '50%', background: '#fff',
                      transition: 'left 0.2s',
                    }} />
                  </div>
                </label>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={s.label}>Máx. mensajes del bot antes de handoff</label>
                <input
                  type="number"
                  min={1} max={50}
                  style={{ ...s.input, width: 100 }}
                  value={config.maxMessages}
                  onChange={e => setConfig(c => c ? { ...c, maxMessages: parseInt(e.target.value) || 6 } : c)}
                />
              </div>

              <div>
                <label style={s.label}>Mensaje de handoff al humano</label>
                <textarea
                  rows={3}
                  style={s.textarea}
                  value={config.handoffMessage}
                  onChange={e => setConfig(c => c ? { ...c, handoffMessage: e.target.value } : c)}
                />
              </div>
            </div>

            {/* System Prompt */}
            <div style={s.section}>
              <h3 style={{ margin: '0 0 14px', fontSize: 14, color: '#fff', fontWeight: 600 }}>📝 Prompt Maestro</h3>

              <textarea
                rows={16}
                style={{ ...s.textarea, marginBottom: 12 }}
                value={config.systemPrompt}
                onChange={e => setConfig(c => c ? { ...c, systemPrompt: e.target.value } : c)}
              />

              {/* AI improvement box */}
              <div style={{ background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: 8, padding: 12 }}>
                <p style={{ margin: '0 0 8px', fontSize: 12, color: '#666' }}>✨ Mejorar con IA — describe qué cambiar:</p>
                <textarea
                  rows={2}
                  style={{ ...s.textarea, marginBottom: 8, fontSize: 12 }}
                  placeholder='Ej: "Hazlo más empático y agrega énfasis en el diagnóstico gratuito"'
                  value={aiInstructions}
                  onChange={e => setAiInstructions(e.target.value)}
                />
                <button
                  onClick={improvePromptWithAI}
                  disabled={aiImproving || !aiInstructions.trim()}
                  style={{
                    ...s.btnSecondary,
                    opacity: aiImproving || !aiInstructions.trim() ? 0.5 : 1,
                    fontSize: 12,
                    padding: '7px 14px',
                  }}
                >
                  {aiImproving ? '⏳ Mejorando...' : '✨ Mejorar con IA'}
                </button>
              </div>
            </div>

            {/* Save button */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button onClick={saveConfig} disabled={saving} style={s.btnPrimary}>
                {saving ? 'Guardando...' : '💾 Guardar cambios'}
              </button>
              {saved && <span style={{ color: '#25D366', fontSize: 13 }}>✓ Guardado</span>}
            </div>
          </>
        )}

        {/* ETIQUETAS SECTION */}
        {activeSection === 'etiquetas' && (
          <>
            <div style={s.section}>
              <h3 style={{ margin: '0 0 14px', fontSize: 14, color: '#fff', fontWeight: 600 }}>🏷️ Crear nueva etiqueta</h3>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <label style={s.label}>Nombre</label>
                  <input
                    style={s.input}
                    value={newLabelName}
                    onChange={e => setNewLabelName(e.target.value)}
                    placeholder='Ej: Prospecto caliente'
                    onKeyDown={e => { if (e.key === 'Enter') createLabel() }}
                  />
                </div>
                <div>
                  <label style={s.label}>Color</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                    {LABEL_COLORS.map(color => (
                      <button
                        key={color}
                        onClick={() => setNewLabelColor(color)}
                        style={{
                          width: 26, height: 26,
                          borderRadius: '50%',
                          background: color,
                          border: newLabelColor === color ? '3px solid #fff' : '2px solid transparent',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      />
                    ))}
                  </div>
                </div>
                <button
                  onClick={createLabel}
                  disabled={creatingLabel || !newLabelName.trim()}
                  style={{ ...s.btnPrimary, opacity: creatingLabel || !newLabelName.trim() ? 0.5 : 1 }}
                >
                  {creatingLabel ? '...' : '+ Crear'}
                </button>
              </div>
            </div>

            <div style={s.section}>
              <h3 style={{ margin: '0 0 14px', fontSize: 14, color: '#fff', fontWeight: 600 }}>Etiquetas existentes</h3>
              {labels.length === 0 && (
                <p style={{ color: '#555', fontSize: 13 }}>No hay etiquetas aún.</p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {labels.map(l => (
                  <div key={l.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: '#0a0a0a', borderRadius: 8,
                    padding: '10px 12px', border: `1px solid ${l.color}33`,
                  }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: l.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, color: '#e0e0e0' }}>{l.name}</span>
                    <span style={{
                      background: l.color + '22',
                      color: l.color,
                      border: `1px solid ${l.color}44`,
                      borderRadius: 10,
                      padding: '2px 10px',
                      fontSize: 11,
                      fontWeight: 600,
                    }}>{l.name}</span>
                    <button
                      onClick={() => deleteLabel(l.id)}
                      style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* USUARIOS SECTION */}
        {activeSection === 'usuarios' && (
          <>
            <div style={s.section}>
              <h3 style={{ margin: '0 0 14px', fontSize: 14, color: '#fff', fontWeight: 600 }}>👥 Agregar acceso</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={s.label}>Correo electrónico</label>
                  <input
                    style={s.input}
                    type="email"
                    value={newUserEmail}
                    onChange={e => setNewUserEmail(e.target.value)}
                    placeholder="usuario@email.com"
                  />
                </div>
                <div>
                  <label style={s.label}>Contraseña</label>
                  <input
                    style={s.input}
                    type="text"
                    value={newUserPassword}
                    onChange={e => setNewUserPassword(e.target.value)}
                    placeholder="Contraseña para este usuario"
                  />
                </div>
                <div>
                  <label style={s.label}>Rol</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['user', 'admin'] as const).map(r => (
                      <button
                        key={r}
                        onClick={() => setNewUserRole(r)}
                        style={{
                          ...s.btnSecondary,
                          background: newUserRole === r ? '#0d2a1e' : '#1a1a1a',
                          color: newUserRole === r ? '#25D366' : '#888',
                          border: newUserRole === r ? '1px solid #25D36644' : '1px solid #222',
                          fontSize: 13,
                          padding: '7px 14px',
                        }}
                      >
                        {r === 'user' ? '👤 Usuario' : '🔑 Admin'}
                      </button>
                    ))}
                  </div>
                </div>
                {userError && (
                  <p style={{ color: '#f87171', fontSize: 12, margin: 0 }}>{userError}</p>
                )}
                <div>
                  <button
                    onClick={createAppUser}
                    disabled={creatingUser || !newUserEmail.trim() || !newUserPassword.trim()}
                    style={{ ...s.btnPrimary, opacity: creatingUser || !newUserEmail.trim() || !newUserPassword.trim() ? 0.5 : 1 }}
                  >
                    {creatingUser ? 'Creando...' : '+ Agregar usuario'}
                  </button>
                </div>
              </div>
            </div>

            <div style={s.section}>
              <h3 style={{ margin: '0 0 14px', fontSize: 14, color: '#fff', fontWeight: 600 }}>Usuarios con acceso</h3>
              {users.length === 0 && (
                <p style={{ color: '#555', fontSize: 13 }}>No hay usuarios registrados.</p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {users.map(u => (
                  <div key={u.email} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: '#0a0a0a', borderRadius: 8,
                    padding: '11px 14px', border: '1px solid #1e1e1e',
                  }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: '50%',
                      background: u.role === 'admin' ? '#1e2a3a' : '#1a1a1a',
                      color: u.role === 'admin' ? '#3b82f6' : '#888',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, flexShrink: 0,
                    }}>
                      {u.role === 'admin' ? '🔑' : '👤'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: '#e0e0e0', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.email}
                      </div>
                      <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
                        {u.role === 'admin' ? 'Administrador' : 'Usuario'} · desde {new Date(u.createdAt).toLocaleDateString('es-EC')}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteAppUser(u.email)}
                      style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: 18, padding: '0 4px', flexShrink: 0 }}
                      title="Eliminar acceso"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* PLANTILLAS SECTION */}
        {activeSection === 'plantillas' && templates && (
          <>
            <p style={{ fontSize: 12, color: '#555', margin: '0 0 16px' }}>
              Variables disponibles: <code style={{ color: '#25D366' }}>{'{nombre}'}</code> <code style={{ color: '#25D366' }}>{'{fecha}'}</code> <code style={{ color: '#25D366' }}>{'{hora}'}</code> <code style={{ color: '#25D366' }}>{'{servicio}'}</code>
            </p>

            {(['confirm', 'reminder', 'post'] as const).map(type => {
              const labels: Record<string, { icon: string; title: string; hint: string }> = {
                confirm: { icon: '❓', title: 'Confirmación de asistencia', hint: 'Se envía 24h antes. Debe incluir SÍ/NO para que el parser funcione.' },
                reminder: { icon: '☀️', title: 'Recordatorio día de la cita', hint: 'Se envía entre las 8-10am del día de la cita (confirmadas).' },
                post: { icon: '⭐', title: 'Mensaje post-cita', hint: 'Se envía 2-4h después de la cita (confirmadas/completadas).' },
              }
              const meta = labels[type]
              return (
                <div key={type} style={s.section}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 14, color: '#fff', fontWeight: 600 }}>{meta.icon} {meta.title}</h3>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {savedTpl === type && <span style={{ color: '#25D366', fontSize: 12 }}>✓ Guardado</span>}
                      <button
                        onClick={() => saveTemplate(type)}
                        disabled={savingTpl === type}
                        style={{ ...s.btnPrimary, padding: '6px 14px', fontSize: 12, opacity: savingTpl === type ? 0.6 : 1 }}
                      >
                        {savingTpl === type ? '...' : '💾 Guardar'}
                      </button>
                    </div>
                  </div>
                  <p style={{ margin: '0 0 10px', fontSize: 11, color: '#555' }}>{meta.hint}</p>
                  <textarea
                    rows={5}
                    style={s.textarea}
                    value={templates[type]}
                    onChange={e => setTemplates(t => t ? { ...t, [type]: e.target.value } : t)}
                  />
                </div>
              )
            })}
          </>
        )}
      </div>
    </AppShell>
  )
}
