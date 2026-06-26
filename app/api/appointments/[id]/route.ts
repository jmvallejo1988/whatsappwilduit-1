import { NextRequest, NextResponse } from 'next/server'
import { getAppointment, updateAppointment, deleteAppointment } from '@/lib/appointments'
import { updateGCalEvent, cancelGCalEvent, deleteGCalEvent, isGCalConfigured } from '@/lib/gcal'

type Params = { params: { id: string } }

// GET /api/appointments/:id
export async function GET(_req: NextRequest, { params }: Params) {
  const appt = await getAppointment(params.id)
  if (!appt) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ appointment: appt })
}

// PUT /api/appointments/:id
// body: partial Appointment fields
export async function PUT(req: NextRequest, { params }: Params) {
  const body = await req.json()
  const appt = await updateAppointment(params.id, body)
  if (!appt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Sync to Google Calendar
  if (isGCalConfigured() && appt.gcal_event_id) {
    try {
      if (body.status === 'cancelled') {
        await cancelGCalEvent(appt.gcal_event_id)
      } else if (body.datetime || body.service || body.name) {
        const updates: Parameters<typeof updateGCalEvent>[1] = {}
        if (body.service || body.name) {
          updates.summary = `${appt.service} — ${appt.name}`
        }
        if (body.datetime) {
          const end = new Date(new Date(body.datetime).getTime() + 60 * 60_000)
          updates.startDatetime = body.datetime
          updates.endDatetime = end.toISOString().slice(0, 19)
        }
        await updateGCalEvent(appt.gcal_event_id, updates)
      }
    } catch (err) {
      console.error('GCAL_UPDATE_ERROR', err)
    }
  }

  return NextResponse.json({ appointment: appt })
}

// DELETE /api/appointments/:id
export async function DELETE(_req: NextRequest, { params }: Params) {
  const appt = await getAppointment(params.id)
  if (!appt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (isGCalConfigured() && appt.gcal_event_id) {
    try {
      await deleteGCalEvent(appt.gcal_event_id)
    } catch (err) {
      console.error('GCAL_DELETE_ERROR', err)
    }
  }

  await deleteAppointment(params.id)
  return NextResponse.json({ ok: true })
}
