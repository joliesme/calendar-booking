import { NextResponse } from 'next/server'
import {
  getBookings, createBooking, getSlotById, updateBookingOutlookId,
  findExistingBookings, getSetting,
} from '@/lib/db.js'
import { requireAdmin } from '@/lib/auth.js'
import { createOutlookEvent, isOutlookConnected, outlookConfigured } from '@/lib/outlook.js'

// GET /api/bookings  — admin only
export async function GET(request) {
  const deny = requireAdmin(request)
  if (deny) return deny
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || undefined
  return NextResponse.json(getBookings({ status }))
}

// POST /api/bookings  — public: create a new booking
export async function POST(request) {
  const body = await request.json()
  const { slot_id, name, email, phone, answers } = body

  if (!slot_id || !name || !email) {
    return NextResponse.json({ error: 'slot_id, name, and email are required' }, { status: 400 })
  }

  // Check slot availability
  const slot = getSlotById(slot_id)
  if (!slot) {
    return NextResponse.json({ error: 'Slot not found' }, { status: 404 })
  }
  if (slot.booking_count >= slot.max_bookings) {
    return NextResponse.json({ error: 'Slot is no longer available' }, { status: 409 })
  }

  // Duplicate person check — email OR name match among confirmed bookings
  const allowDuplicates = getSetting('allow_duplicate_bookings') === 'true'
  if (!allowDuplicates) {
    const existing = findExistingBookings(email, name)
    if (existing.length > 0) {
      return NextResponse.json({
        error: 'duplicate',
        message: 'A booking already exists for this name or email.',
        existing: existing[0],
      }, { status: 409 })
    }
  }

  const booking = createBooking({ slot_id, name, email, phone, answers })

  // Sync to Outlook if connected
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
      updateBookingOutlookId(booking.id, eventId)
      booking.outlook_event_id = eventId
    } catch (err) {
      console.error('Outlook sync failed (booking still created):', err.message)
    }
  }

  return NextResponse.json(booking, { status: 201 })
}

function buildEventDescription(name, email, phone, answers) {
  const lines = [`Booking by ${name}`, `Email: ${email}`]
  if (phone) lines.push(`Phone: ${phone}`)
  if (answers && typeof answers === 'object') {
    for (const [key, val] of Object.entries(answers)) {
      lines.push(`${key}: ${val}`)
    }
  }
  return lines.join('<br>')
}
