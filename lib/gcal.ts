/**
 * Google Calendar — Service Account integration
 * Zero extra dependencies: JWT signing via Node.js crypto (built-in).
 *
 * Required env vars:
 *   GOOGLE_SERVICE_ACCOUNT_JSON  → full JSON string of the service account key
 *   GOOGLE_CALENDAR_ID           → calendar ID (usually your Gmail address)
 */

import { createSign } from 'crypto'

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3'

type ServiceAccount = {
  client_email: string
  private_key: string
}

function base64url(input: string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** Get a short-lived access token from the service account credentials */
async function getAccessToken(): Promise<string> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not set')

  const sa: ServiceAccount = JSON.parse(raw)
  const now = Math.floor(Date.now() / 1000)

  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = base64url(JSON.stringify({
    iss: sa.client_email,
    scope: CALENDAR_SCOPE,
    aud: TOKEN_URL,
    exp: now + 3600,
    iat: now,
  }))

  const signingInput = `${header}.${payload}`
  const sign = createSign('RSA-SHA256')
  sign.update(signingInput)
  const signature = sign.sign(sa.private_key).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const jwt = `${signingInput}.${signature}`

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  const data = await res.json()
  if (!data.access_token) {
    throw new Error(`GCal token error: ${JSON.stringify(data)}`)
  }
  return data.access_token as string
}

function getCalendarId(): string {
  const id = process.env.GOOGLE_CALENDAR_ID
  if (!id) throw new Error('GOOGLE_CALENDAR_ID not set')
  return id
}

// ── PUBLIC API ────────────────────────────────────────────────────────────────

export type GCalEvent = {
  summary: string          // title
  description?: string
  startDatetime: string    // ISO 8601 local e.g. "2026-07-01T10:00:00"
  endDatetime: string      // ISO 8601 local e.g. "2026-07-01T11:00:00"
  timeZone?: string        // default: America/Guayaquil
  attendeePhone?: string   // for notes only (GCal doesn't support WA)
}

/** Create an event and return its GCal event ID */
export async function createGCalEvent(event: GCalEvent): Promise<string> {
  const token = await getAccessToken()
  const calId = encodeURIComponent(getCalendarId())
  const tz = event.timeZone ?? 'America/Guayaquil'

  const body = {
    summary: event.summary,
    description: event.description ?? '',
    start: { dateTime: event.startDatetime, timeZone: tz },
    end: { dateTime: event.endDatetime, timeZone: tz },
  }

  const res = await fetch(`${CALENDAR_BASE}/calendars/${calId}/events`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(`GCal create error: ${JSON.stringify(data)}`)
  return data.id as string
}

/** Update an existing event (partial update) */
export async function updateGCalEvent(
  eventId: string,
  updates: Partial<GCalEvent>
): Promise<void> {
  const token = await getAccessToken()
  const calId = encodeURIComponent(getCalendarId())
  const tz = updates.timeZone ?? 'America/Guayaquil'

  const body: Record<string, unknown> = {}
  if (updates.summary) body.summary = updates.summary
  if (updates.description !== undefined) body.description = updates.description
  if (updates.startDatetime) body.start = { dateTime: updates.startDatetime, timeZone: tz }
  if (updates.endDatetime) body.end = { dateTime: updates.endDatetime, timeZone: tz }

  const res = await fetch(`${CALENDAR_BASE}/calendars/${calId}/events/${eventId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const data = await res.json()
    throw new Error(`GCal update error: ${JSON.stringify(data)}`)
  }
}

/** Mark event as cancelled (keeps it in calendar but crossed out) */
export async function cancelGCalEvent(eventId: string): Promise<void> {
  const token = await getAccessToken()
  const calId = encodeURIComponent(getCalendarId())

  const res = await fetch(`${CALENDAR_BASE}/calendars/${calId}/events/${eventId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: 'cancelled' }),
  })

  if (!res.ok) {
    const data = await res.json()
    throw new Error(`GCal cancel error: ${JSON.stringify(data)}`)
  }
}

/** Delete event permanently */
export async function deleteGCalEvent(eventId: string): Promise<void> {
  const token = await getAccessToken()
  const calId = encodeURIComponent(getCalendarId())

  const res = await fetch(`${CALENDAR_BASE}/calendars/${calId}/events/${eventId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok && res.status !== 410) { // 410 = already deleted
    const data = await res.text()
    throw new Error(`GCal delete error ${res.status}: ${data}`)
  }
}

/** Check if GCal integration is configured */
export function isGCalConfigured(): boolean {
  return !!(process.env.GOOGLE_SERVICE_ACCOUNT_JSON && process.env.GOOGLE_CALENDAR_ID)
}
