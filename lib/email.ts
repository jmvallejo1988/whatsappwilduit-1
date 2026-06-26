/**
 * Email via Resend API (fetch — no SDK required)
 * Env var required: RESEND_API_KEY
 * Optional: RESEND_FROM_EMAIL (default: citas@wilduit.com)
 */

import type { Appointment } from './appointments'

const RESEND_API = 'https://api.resend.com/emails'

function getFrom(): string {
  return process.env.RESEND_FROM_EMAIL || 'Wilduit WA <citas@wilduit.com>'
}

async function sendEmail(opts: {
  to: string
  subject: string
  html: string
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY not set')

  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: getFrom(),
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Resend error ${res.status}: ${err}`)
  }
}

function formatDateES(iso: string): string {
  return new Date(iso).toLocaleDateString('es-EC', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'America/Guayaquil',
  })
}

function formatTimeES(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-EC', {
    hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone: 'America/Guayaquil',
  })
}

// ── Email templates ───────────────────────────────────────────────────────────

function confirmationHtml(appt: Appointment): string {
  const fecha = formatDateES(appt.datetime)
  const hora = formatTimeES(appt.datetime)
  const meet = (appt as Appointment & { meet_link?: string }).meet_link

  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <tr><td style="background:#0d2a1e;padding:24px 32px;">
          <h1 style="color:#25D366;margin:0;font-size:22px;">✅ Cita confirmada</h1>
          <p style="color:#aaa;margin:6px 0 0;font-size:14px;">Wilduit WA Manager</p>
        </td></tr>
        <tr><td style="padding:28px 32px;">
          <p style="color:#333;font-size:16px;margin:0 0 24px;">Hola <strong>${appt.name}</strong>, tu cita ha sido registrada.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border-radius:10px;padding:20px;margin-bottom:24px;">
            <tr><td style="padding:6px 0;color:#555;font-size:14px;">📋 <strong>Servicio</strong></td><td style="color:#111;font-size:14px;text-align:right;">${appt.service}</td></tr>
            <tr><td style="padding:6px 0;color:#555;font-size:14px;">📅 <strong>Fecha</strong></td><td style="color:#111;font-size:14px;text-align:right;">${fecha}</td></tr>
            <tr><td style="padding:6px 0;color:#555;font-size:14px;">🕐 <strong>Hora</strong></td><td style="color:#111;font-size:14px;text-align:right;">${hora}</td></tr>
            ${meet ? `<tr><td style="padding:6px 0;color:#555;font-size:14px;">🎥 <strong>Google Meet</strong></td><td style="color:#111;font-size:14px;text-align:right;"><a href="${meet}" style="color:#128c4a;">${meet}</a></td></tr>` : ''}
          </table>
          ${meet ? `<a href="${meet}" style="display:block;background:#128c4a;color:#fff;text-decoration:none;text-align:center;padding:14px;border-radius:10px;font-weight:600;font-size:15px;margin-bottom:16px;">🎥 Unirse al Meet</a>` : ''}
          <p style="color:#888;font-size:13px;margin:0;">Recibirás un recordatorio por WhatsApp el día de la cita.</p>
        </td></tr>
        <tr><td style="background:#f0f0f0;padding:16px 32px;text-align:center;">
          <p style="color:#aaa;font-size:12px;margin:0;">Wilduit Boost Digital · wilduit.com</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function reminderHtml(appt: Appointment): string {
  const hora = formatTimeES(appt.datetime)
  const meet = (appt as Appointment & { meet_link?: string }).meet_link

  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <tr><td style="background:#0d2a1e;padding:24px 32px;">
          <h1 style="color:#25D366;margin:0;font-size:22px;">🌅 Hoy tienes una cita</h1>
          <p style="color:#aaa;margin:6px 0 0;font-size:14px;">Recordatorio de Wilduit WA Manager</p>
        </td></tr>
        <tr><td style="padding:28px 32px;">
          <p style="color:#333;font-size:16px;margin:0 0 20px;">Hola <strong>${appt.name}</strong>, hoy es tu cita para <strong>${appt.service}</strong> a las <strong>${hora}</strong>. ¡Te esperamos!</p>
          ${meet ? `<a href="${meet}" style="display:block;background:#128c4a;color:#fff;text-decoration:none;text-align:center;padding:14px;border-radius:10px;font-weight:600;font-size:15px;">🎥 Unirse al Meet ahora</a>` : ''}
        </td></tr>
        <tr><td style="background:#f0f0f0;padding:16px 32px;text-align:center;">
          <p style="color:#aaa;font-size:12px;margin:0;">Wilduit Boost Digital · wilduit.com</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Send a booking confirmation email to the client.
 * `toEmail` must be provided — we don't store email in appointments by default.
 * If no email, caller should silently skip.
 */
export async function sendConfirmationEmail(
  appt: Appointment,
  toEmail: string
): Promise<void> {
  await sendEmail({
    to: toEmail,
    subject: `✅ Cita confirmada — ${appt.service} · Wilduit`,
    html: confirmationHtml(appt),
  })
}

/** Send a same-day reminder email */
export async function sendReminderEmail(
  appt: Appointment,
  toEmail: string
): Promise<void> {
  await sendEmail({
    to: toEmail,
    subject: `🌅 Hoy a las ${formatTimeES(appt.datetime)} — ${appt.service}`,
    html: reminderHtml(appt),
  })
}

/** Check if email sending is configured */
export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY
}
