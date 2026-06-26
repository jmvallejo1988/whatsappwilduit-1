/**
 * Cron: runs every day at 8am EC (13:00 UTC) via Vercel Cron
 * Handles:
 *   - Confirmation WA message + email: 16-50h before appointment (status: pending)
 *   - Reminder WA message + email: same day within 16h (status: confirmed)
 *   - Post-appointment WA message: 2-26h after datetime (status: confirmed/completed)
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
import { sendConfirmationEmail, sendReminderEmail, isEmailConfigured } from '@/lib/email'

export const runtime = 'nodejs'

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const nowMs = now.getTime()
  const results = { confirm: 0, reminder: 0, post: 0, updated: 0, errors: 0 }
  const emailEnabled = isEmailConfigured()

  console.log('CRON_APPOINTMENTS start', now.toISOString())

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
        if (appt.status === 'pending' && hoursPast > 1) {
          await updateAppointment(appt.id, { status: 'no_show' })
          results.updated++
          console.log(`CRON_NO_SHOW appt=${appt.id}`)
          continue
        }
        if (appt.status === 'confirmed' && hoursPast > 0.5) {
          await updateAppointment(appt.id, { status: 'completed' })
          results.updated++
          console.log(`CRON_COMPLETED appt=${appt.id}`)
        }
      }

      // ── CONFIRMATION MESSAGE (16-50h before) ─────────────────────────────
      if (appt.status === 'pending' && hoursUntil >= 16 && hoursUntil <= 50) {
        const sent = await isSchedulerSent(appt.id, 'confirm')
        if (!sent) {
          const msg = await buildMessage('confirm', appt)
          await sendTextMessage(appt.phone, msg)
          await markSchedulerSent(appt.id, 'confirm')
          await setPendingConfirm(appt.phone, appt.id)
          results.confirm++
          console.log(`CRON_CONFIRM_WA_SENT appt=${appt.id} phone=${appt.phone}`)

          if (emailEnabled && appt.email) {
            await sendConfirmationEmail(appt, appt.email).catch((err) =>
              console.error(`CRON_CONFIRM_EMAIL_ERROR appt=${appt.id}`, err)
            )
            console.log(`CRON_CONFIRM_EMAIL_SENT appt=${appt.id} email=${appt.email}`)
          }
        }
      }

      // ── REMINDER MESSAGE (same day, within 16h) ───────────────────────────
      if (appt.status === 'confirmed' && hoursUntil >= 0 && hoursUntil <= 16) {
        const sent = await isSchedulerSent(appt.id, 'reminder')
        if (!sent) {
          const msg = await buildMessage('reminder', appt)
          await sendTextMessage(appt.phone, msg)
          await markSchedulerSent(appt.id, 'reminder')
          results.reminder++
          console.log(`CRON_REMINDER_WA_SENT appt=${appt.id} phone=${appt.phone}`)

          if (emailEnabled && appt.email) {
            await sendReminderEmail(appt, appt.email).catch((err) =>
              console.error(`CRON_REMINDER_EMAIL_ERROR appt=${appt.id}`, err)
            )
            console.log(`CRON_REMINDER_EMAIL_SENT appt=${appt.id} email=${appt.email}`)
          }
        }
      }

      // ── POST-APPOINTMENT MESSAGE (2-26h after) ────────────────────────────
      if (
        (appt.status === 'confirmed' || appt.status === 'completed') &&
        hoursPast >= 2 && hoursPast <= 26
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
