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
  attendeeEmail?: string   // optional — adds attendee and sends invite
  createMeet?: boolean     // default: true — attach a Google Meet link
}

export type GCalCreatedEvent = {
  id: string
  meetLink?: string        // Google Meet URL (if createMeet = true)
  htmlLink?: string        // URL to open the event in Google Calendar
}

/** Create an event with optional Google Meet link, return id + meetLink */
export async function createGCalEvent(event: GCalEvent): Promise<GCalCreatedEvent> {
  const token = await getAccessToken()
  const calId = encodeURIComponent(getCalendarId())
  const tz = event.timeZone ?? 'America/Guayaquil'
  const withMeet = event.createMeet !== false // default true

  const requestId = `wilduit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  const body: Record<string, unknown> = {
    summary: event.summary,
    description: event.description ?? '',
    start: { dateTime: event.startDatetime, timeZone: tz },
    end: { dateTime: event.endDatetime, timeZone: tz },
  }

  if (event.attendeeEmail) {
    body.attendees = [{ email: event.attendeeEmail }]
  }

  if (withMeet) {
    body.conferenceData = {
      createRequest: {
        requestId,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    }
  }

  // conferenceDataVersion=1 required for Meet links
  const url = `${CALENDAR_BASE}/calendars/${calId}/events${withMeet ? '?conferenceDataVersion=1' : ''}`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(`GCal create error: ${JSON.stringify(data)}`)

  const meetLink = (data.conferenceData?.entryPoints as Array<{ entryPointType: string; uri: string }> | undefined)
    ?.find((ep) => ep.entryPointType === 'video')?.uri

  return {
    id: data.id as string,
    meetLink,
    htmlLink: data.htmlLink as string | undefined,
  }
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

// ── AVAILABILITY ──────────────────────────────────────────────────────────────

export type TimeSlot = {
  date: string      // "2026-07-01"
  label: string     // "Martes 1 de julio · 9:00 AM – 10:00 AM"
  start: string     // "09:00 AM"
  end: string       // "10:00 AM"
  startIso: string  // full ISO
  endIso: string    // full ISO
}

/**
 * Returns available time slots for the next `daysAhead` days.
 * Uses the GCal freeBusy API to find busy blocks, then subtracts them.
 */
export async function getAvailableSlots(opts?: {
  daysAhead?: number
  slotMinutes?: number
  workStart?: number
  workEnd?: number
  tz?: string
}): Promise<TimeSlot[]> {
  const daysAhead = opts?.daysAhead ?? 5
  const slotMinutes = opts?.slotMinutes ?? 60
  const workStart = opts?.workStart ?? 9
  const workEnd = opts?.workEnd ?? 18
  const tz = opts?.tz ?? 'America/Guayaquil'
  const calId = getCalendarId()
  const token = await getAccessToken()

  const now = new Date()
  const windowStart = new Date(now)
  windowStart.setDate(now.getDate() + 1)
  windowStart.setHours(0, 0, 0, 0)

  const windowEnd = new Date(now)
  windowEnd.setDate(now.getDate() + daysAhead + 1)
  windowEnd.setHours(23, 59, 59, 999)

  // Query freeBusy
  const fbRes = await fetch(`${CALENDAR_BASE}/freeBusy`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      timeMin: windowStart.toISOString(),
      timeMax: windowEnd.toISOString(),
      timeZone: tz,
      items: [{ id: calId }],
    }),
  })

  const fbData = await fbRes.json()
  if (!fbRes.ok) throw new Error(`GCal freeBusy error: ${JSON.stringify(fbData)}`)

  const busyBlocks: Array<{ start: string; end: string }> =
    fbData.calendars?.[calId]?.busy ?? []

  const busyMs = busyBlocks.map((b) => ({
    start: new Date(b.start).getTime(),
    end: new Date(b.end).getTime(),
  }))

  const slots: TimeSlot[] = []
  const slotMs = slotMinutes * 60_000

  for (let d = 1; d <= daysAhead; d++) {
    const day = new Date(now)
    day.setDate(now.getDate() + d)

    const dayStart = new Date(day)
    dayStart.setHours(workStart, 0, 0, 0)
    const dayEnd = new Date(day)
    dayEnd.setHours(workEnd, 0, 0, 0)

    let cursor = dayStart.getTime()
    while (cursor + slotMs <= dayEnd.getTime()) {
      const slotStart = cursor
      const slotEnd = cursor + slotMs

      // Overlap check with 5-min buffer
      const isBusy = busyMs.some(
        (b) => slotStart < b.end + 5 * 60_000 && slotEnd > b.start - 5 * 60_000
      )

      if (!isBusy) {
        const startDate = new Date(slotStart)
        const endDate = new Date(slotEnd)

        const dateStr = startDate.toLocaleDateString('es-EC', {
          weekday: 'long', day: 'numeric', month: 'long', timeZone: tz,
        })
        const startTime = startDate.toLocaleTimeString('es-EC', {
          hour: '2-digit', minute: '2-digit', hour12: true, timeZone: tz,
        })
        const endTime = endDate.toLocaleTimeString('es-EC', {
          hour: '2-digit', minute: '2-digit', hour12: true, timeZone: tz,
        })
        const isoDate = startDate.toLocaleDateString('en-CA', { timeZone: tz })

        slots.push({
          date: isoDate,
          label: `${dateStr.charAt(0).toUpperCase() + dateStr.slice(1)} · ${startTime} – ${endTime}`,
          start: startTime,
          end: endTime,
          startIso: startDate.toISOString(),
          endIso: endDate.toISOString(),
        })
      }

      cursor += slotMs
    }
  }

  return slots
}

/**
 * Returns a short human-readable bullet list of available slots,
 * ready to be injected into the bot's system prompt.
 */
export async function getAvailabilitySummary(maxSlots = 6): Promise<string> {
  try {
    const slots = await getAvailableSlots({ daysAhead: 5 })
    if (!slots.length) return 'No hay horarios disponibles en los próximos 5 días.'
    return slots.slice(0, maxSlots).map((s) => `• ${s.label}`).join('\n')
  } catch {
    return ''
  }
}
