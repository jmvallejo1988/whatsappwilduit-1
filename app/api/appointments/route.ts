import { NextRequest, NextResponse } from 'next/server'
import {
  createAppointment,
  listAppointments,
} from '@/lib/appointments'
import { createGCalEvent, isGCalConfigured } from '@/lib/gcal'
import { sendConfirmationEmail, isEmailConfigured } from '@/lib/email'

// GET /api/appointments?from=ISO&to=ISO
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')

  const from = fromParam ? new Date(fromParam) : new Date(Date.now() - 7 * 86400_000)
  const to = toParam ? new Date(toParam) : new Date(Date.now() + 30 * 86400_000)

  const appointments = await listAppointments({ from, to })
  return NextResponse.json({ appointments })
}

// POST /api/appointments
// body: { phone, name, service, datetime, notes?, email? }
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { phone, name, service, datetime, notes, email } = body

  if (!phone || !name || !service || !datetime) {
    return NextResponse.json(
      { error: 'phone, name, service y datetime son requeridos' },
      { status: 400 }
    )
  }

  const appt = await createAppointment({ phone, name, service, datetime, notes, email })

  // Create Google Calendar event with Meet link (non-blocking)
  if (isGCalConfigured()) {
    try {
      const start = new Date(datetime)
      const end = new Date(start.getTime() + 60 * 60_000) // default 1h

      const gcalResult = await createGCalEvent({
        summary: `${service} — ${name}`,
        description: [
          `Cliente: ${name}`,
          `WhatsApp: +${phone}`,
          email ? `Email: ${email}` : '',
          notes ? `Notas: ${notes}` : '',
        ].filter(Boolean).join('\n'),
        startDatetime: datetime,
        endDatetime: end.toISOString().slice(0, 19),
        attendeeEmail: email,    // if provided → sends Google Calendar invite
        createMeet: true,        // always create Meet link
      })

      const { updateAppointment } = await import('@/lib/appointments')
      const updates: Record<string, string> = { gcal_event_id: gcalResult.id }
      if (gcalResult.meetLink) updates.meet_link = gcalResult.meetLink

      await updateAppointment(appt.id, updates)
      appt.gcal_event_id = gcalResult.id
      if (gcalResult.meetLink) appt.meet_link = gcalResult.meetLink

      console.log(`GCAL_CREATED appt=${appt.id} meet=${gcalResult.meetLink ?? 'none'}`)
    } catch (err) {
      console.error('GCAL_CREATE_ERROR', err)
    }
  }

  // Send confirmation email (non-blocking)
  if (isEmailConfigured() && email) {
    sendConfirmationEmail(appt, email).catch((err) =>
      console.error('EMAIL_CONFIRM_ERROR', err)
    )
  }

  return NextResponse.json({ appointment: appt }, { status: 201 })
}
