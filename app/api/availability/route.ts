/**
 * GET /api/availability
 * Returns available time slots from Google Calendar for the next N days.
 * Used by the WhatsApp bot to suggest real available times to prospects.
 *
 * Query params (all optional):
 *   days       — how many days to look ahead (default: 5, max: 14)
 *   slotMin    — slot duration in minutes (default: 60)
 *   workStart  — start of workday in 24h (default: 9)
 *   workEnd    — end of workday in 24h (default: 18)
 *   maxSlots   — max slots to return (default: 12)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAvailableSlots, isGCalConfigured } from '@/lib/gcal'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  if (!isGCalConfigured()) {
    return NextResponse.json({ error: 'GCal not configured' }, { status: 503 })
  }

  const { searchParams } = new URL(req.url)
  const days = Math.min(parseInt(searchParams.get('days') || '5'), 14)
  const slotMin = parseInt(searchParams.get('slotMin') || '60')
  const workStart = parseInt(searchParams.get('workStart') || '9')
  const workEnd = parseInt(searchParams.get('workEnd') || '18')
  const maxSlots = parseInt(searchParams.get('maxSlots') || '12')

  try {
    const slots = await getAvailableSlots({
      daysAhead: days,
      slotMinutes: slotMin,
      workStart,
      workEnd,
    })

    const limited = slots.slice(0, maxSlots)

    return NextResponse.json({
      available: limited,
      total: limited.length,
      // Plain-text version ready to inject into bot system prompt
      summary: limited.length
        ? limited.map((s) => `• ${s.label}`).join('\n')
        : 'No hay horarios disponibles.',
    })
  } catch (err) {
    console.error('AVAILABILITY_ERROR', err)
    return NextResponse.json({ error: 'Error consultando disponibilidad' }, { status: 500 })
  }
}
