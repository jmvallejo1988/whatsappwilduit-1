/**
 * Cron: runs every hour via Vercel Cron
 * Handles:
 *   - Confirmation message: 24-48h before appointment (status: pending)
 *   - Reminder message: same day at/after 8am (status: confirmed)
 *   - Post-appointment message: 2h after datetime (status: confirmed/completed)
 *   - Auto-status updates: pending past → no_show, confirmed past → completed
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  listAppointments,
  updateAppointment,
  setPendingConfirm,
  isSchedulerSent,
  markSchedulerSent,
} from '@/lib/appointments'
import { buildMessage } from '@/lib/templates'
import { sendTextMessage } from '@/lib/whatsapp'

export const runtime = 'nodejs'

// Vercel Cron calls with Authorization: Bearer CRON_SECRET
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true // dev: no secret required
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

function nowEC(): Date {
  // America/Guayaquil = UTC-5 (no DST)
  return new Date(Date.now())
}


export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = nowEC()
  const nowMs = now.getTime()
  const results = { confirm: 0, reminder: 0, post: 0, updated: 0, errors: 0 }

  console.log('CRON_APPOINTMENTS start', now.toISOString())

  // Fetch appointments in a wide window: from 7 days ago to 49h from now
  const from = new Date(nowMs - 7 * 86400_000)
  const to = new Date(nowMs + 49 * 3600_000)
  const appointments = await listAppointments({ from, to })

  for (const appt of appointments) {
    const apptMs = new Date(appt.datetime).getTime()
    const hoursUntil = (apptMs - nowMs) / 3600_000
    const hoursPast = (nowMs - apptMs) / 3600_000

    try {
      // ── AUTO STATUS UPDATES ───────────────────────────────────────────────
      if (apptMs < nowMs) {
        // Appointment time has passed
        if (appt.status === 'pending' && hoursPast > 1) {
          // Client never confirmed — mark as no_show
          await updateAppointment(appt.id, { status: 'no_show' })
          results.updated++
          console.log(`CRON_NO_SHOW appt=${appt.id}`)
          continue
        }
        if (appt.status === 'confirmed' && hoursPast > 0.5) {
          // Confirmed appointment that's passed — mark as completed
          await updateAppointment(appt.id, { status: 'completed' })
          results.updated++
          console.log(`CRON_COMPLETED appt=${appt.id}`)
          // Don't continue — still need to check post message below
        }
      }

      // ── CONFIRMATION MESSAGE ──────────────────────────────────────────────
      // Cron runs daily at 8am EC. Window: appointments 16-50h away covers
      // "tomorrow" and "day after tomorrow" without double-sending (dedup flag).
      if (
        appt.status === 'pending' &&
        hoursUntil >= 16 &&
        hoursUntil <= 50
      ) {
        const sent = await isSchedulerSent(appt.id, 'confirm')
        if (!sent) {
          const msg = await buildMessage('confirm', appt)
          await sendTextMessage(appt.phone, msg)
          await markSchedulerSent(appt.id, 'confirm')
          await setPendingConfirm(appt.phone, appt.id)
          results.confirm++
          console.log(`CRON_CONFIRM_SENT appt=${appt.id} phone=${appt.phone}`)
        }
      }

      // ── REMINDER MESSAGE ──────────────────────────────────────────────────
      // Cron runs at 8am EC daily — send for today's confirmed appointments.
      // Window: appointments within next 16h from 8am covers all of today.
      if (
        appt.status === 'confirmed' &&
        hoursUntil >= 0 &&
        hoursUntil <= 16
      ) {
        const sent = await isSchedulerSent(appt.id, 'reminder')
        if (!sent) {
          const msg = await buildMessage('reminder', appt)
          await sendTextMessage(appt.phone, msg)
          await markSchedulerSent(appt.id, 'reminder')
          results.reminder++
          console.log(`CRON_REMINDER_SENT appt=${appt.id} phone=${appt.phone}`)
        }
      }

      // ── POST-APPOINTMENT MESSAGE ──────────────────────────────────────────
      // Cron runs once daily at 8am. Post message goes to yesterday's completed
      // appointments (passed 2-26h ago) to catch the evening appointments.
      if (
        (appt.status === 'confirmed' || appt.status === 'completed') &&
        hoursPast >= 2 &&
        hoursPast <= 26
      ) {
        const sent = await isSchedulerSent(appt.id, 'post')
        if (!sent) {
          const msg = await buildMessage('post', appt)
          await sendTextMessage(appt.phone, msg)
          await markSchedulerSent(appt.id, 'post')
          results.post++
          console.log(`CRON_POST_SENT appt=${appt.id} phone=${appt.phone}`)
        }
      }
    } catch (err) {
      console.error(`CRON_ERROR appt=${appt.id}`, err)
      results.errors++
    }
  }

  console.log('CRON_APPOINTMENTS done', results)
  return NextResponse.json({ ok: true, processed: appointments.length, ...results })
}
