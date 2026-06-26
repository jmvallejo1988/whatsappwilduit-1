/**
 * Message templates — stored in Redis, editable from UI.
 * Variables: {nombre}, {fecha}, {hora}, {servicio}
 */

import redis from './redis'
import type { Appointment } from './appointments'

export type TemplateType = 'confirm' | 'reminder' | 'post'

const DEFAULT_TEMPLATES: Record<TemplateType, string> = {
  confirm: [
    'Hola {nombre} 👋 Te recordamos que tienes una cita el *{fecha}* a las *{hora}* para *{servicio}*.',
    '',
    '¿Confirmas tu asistencia? Responde *SÍ* para confirmar o *NO* para cancelar. 🗓',
  ].join('\n'),

  reminder: [
    '¡Buenos días {nombre}! ☀️',
    '',
    'Hoy tienes tu cita a las *{hora}* para *{servicio}*. ¡Te esperamos!',
  ].join('\n'),

  post: [
    'Hola {nombre}, esperamos que hayas tenido una excelente experiencia 🌟',
    '',
    '¿Nos puedes dejar una reseña? Y cuando quieras, puedes agendar tu próxima cita.',
  ].join('\n'),
}

// ── REDIS CRUD ────────────────────────────────────────────────────────────────

export async function getTemplate(type: TemplateType): Promise<string> {
  const saved = await redis.get<string>(`template:${type}`)
  return saved ?? DEFAULT_TEMPLATES[type]
}

export async function setTemplate(type: TemplateType, body: string): Promise<void> {
  await redis.set(`template:${type}`, body)
}

export async function getAllTemplates(): Promise<Record<TemplateType, string>> {
  const [confirm, reminder, post] = await Promise.all([
    getTemplate('confirm'),
    getTemplate('reminder'),
    getTemplate('post'),
  ])
  return { confirm, reminder, post }
}

// ── INTERPOLATION ─────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('es-EC', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Guayaquil',
  })
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('es-EC', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Guayaquil',
  })
}

export function interpolate(template: string, appt: Appointment): string {
  return template
    .replace(/{nombre}/g, appt.name)
    .replace(/{fecha}/g, formatDate(appt.datetime))
    .replace(/{hora}/g, formatTime(appt.datetime))
    .replace(/{servicio}/g, appt.service)
}

export async function buildMessage(type: TemplateType, appt: Appointment): Promise<string> {
  const tpl = await getTemplate(type)
  return interpolate(tpl, appt)
}

// ── SÍ/NO PARSER ─────────────────────────────────────────────────────────────

const YES_PATTERNS = /^(sí|si|yes|1|confirmo|confirmar|asisto|asistiré|asistiré|asistire|claro|dale|voy|perfecto|ok|okay|de acuerdo|acepto)/i
const NO_PATTERNS = /^(no|cancel|cancelar|no puedo|no voy|no asistiré|no asistire|imposible)/i

export function parseConfirmation(text: string): 'yes' | 'no' | null {
  const t = text.trim()
  if (YES_PATTERNS.test(t)) return 'yes'
  if (NO_PATTERNS.test(t)) return 'no'
  return null
}
