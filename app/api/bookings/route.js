import { NextResponse } from 'next/server'
import {
  getBookings, createBooking, getSlotById, updateBookingOutlookId,
  findExistingBookings, getSetting,
} from '@/lib/db.js'
import { requireAdmin } from '@/lib/auth.js'
import { createOutlookEvent, isOutlookConnected, outlookConfigured } from '@/lib/outlook.js'
import { Resend } from 'resend'

export async function GET(request) {
  const deny = requireAdmin(request)
  if (deny) return deny
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || undefined
  return NextResponse.json(await getBookings({ status }))
}

export async function POST(request) {
  const body = await request.json()
  const { slot_id, name, email, phone, answers } = body

  if (!slot_id || !name || !email)
    return NextResponse.json({ error: 'slot_id, name, and email are required' }, { status: 400 })

  const slot = await getSlotById(slot_id)
  if (!slot)
    return NextResponse.json({ error: 'Slot not found' }, { status: 404 })
  if (slot.booking_count >= slot.max_bookings)
    return NextResponse.json({ error: 'Slot is no longer available' }, { status: 409 })

  const allowDuplicates = (await getSetting('allow_duplicate_bookings')) === 'true'
  if (!allowDuplicates) {
    const existing = await findExistingBookings(email, name)
    if (existing.length > 0) {
      return NextResponse.json({
        error: 'duplicate',
        message: 'A booking already exists for this name or email.',
        existing: existing[0],
      }, { status: 409 })
    }
  }

  const booking = await createBooking({ slot_id, name, email, phone, answers })

  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: email,
        subject: 'Your booking is confirmed!',
        html: buildConfirmationEmail({ name, booking, slot }),
      })
    } catch (err) {
      console.error('Email send failed (booking still created):', err.message)
    }
  }

  if (outlookConfigured() && isOutlookConnected()) {
    try {
      const eventId = await createOutlookEvent({
        subject:       `Booking: ${name}`,
        start:         slot.start_time,
        end:           slot.end_time,
        attendeeEmail: email,
        attendeeName:  name,
        description:   buildEventDescription(name, email, phone, answers),
      })
      await updateBookingOutlookId(booking.id, eventId)
      booking.outlook_event_id = eventId
    } catch (err) {
      console.error('Outlook sync failed (booking still created):', err.message)
    }
  }

  return NextResponse.json(booking, { status: 201 })
}

function buildConfirmationEmail({ name, booking, slot }) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || ''
  const manageUrl = `${baseUrl}/manage/${booking.id}`
  const start = new Date(slot.start_time)
  const formattedDate = start.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const formattedTime = start.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f3f4f0;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
        <tr><td style="background:#e85c45;padding:28px 32px;">
          <p style="margin:0;color:#fff;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;">Booking confirmed</p>
          <h1 style="margin:8px 0 0;color:#fff;font-size:24px;font-weight:800;">You're all set, ${name}!</h1>
        </td></tr>
        <tr><td style="padding:28px 32px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8a9a8a;">Your slot</p>
          <p style="margin:0 0 24px;font-size:16px;font-weight:600;color:#1a1a1a;">${formattedDate}<br><span style="color:#e85c45;">${formattedTime}</span></p>

          <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8a9a8a;">Booking ID</p>
          <p style="margin:0 0 24px;font-family:monospace;font-size:13px;color:#444;word-break:break-all;">${booking.id}</p>

          <a href="${manageUrl}" style="display:inline-block;background:#e85c45;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 24px;border-radius:10px;">Manage booking →</a>
        </td></tr>
        <tr><td style="padding:16px 32px 28px;border-top:1px solid #f0f0f0;">
          <p style="margin:0;font-size:12px;color:#aaa;">Need to cancel or reschedule? Use the link above. Save your booking ID for reference.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function buildEventDescription(name, email, phone, answers) {
  const lines = [`Booking by ${name}`, `Email: ${email}`]
  if (phone) lines.push(`Phone: ${phone}`)
  if (answers && typeof answers === 'object') {
    for (const [key, val] of Object.entries(answers)) lines.push(`${key}: ${val}`)
  }
  return lines.join('<br>')
}
