import { NextResponse } from 'next/server'
import {
  getBookingById, cancelBooking, updateBookingSlot,
  updateBookingOutlookId, getSlotById, getNextAvailableSlotAfter
} from '@/lib/db.js'
import {
  deleteOutlookEvent, updateOutlookEvent, isOutlookConnected, outlookConfigured
} from '@/lib/outlook.js'

// GET /api/bookings/:id  — public (users look up their own booking)
export async function GET(_, { params }) {
  const { id } = await params
  const booking = getBookingById(id)
  if (!booking) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(booking)
}

// PATCH /api/bookings/:id  — public: reschedule or cancel
export async function PATCH(request, { params }) {
  const { id } = await params
  const booking = getBookingById(id)
  if (!booking) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (booking.status === 'cancelled') {
    return NextResponse.json({ error: 'Booking is already cancelled' }, { status: 409 })
  }

  const body = await request.json()

  // ── Cancel ───────────────────────────────────────────────
  if (body.action === 'cancel') {
    const cancelled = cancelBooking(id)

    if (booking.outlook_event_id && outlookConfigured() && isOutlookConnected()) {
      try { await deleteOutlookEvent(booking.outlook_event_id) } catch (e) {
        console.error('Outlook delete failed:', e.message)
      }
    }

    return NextResponse.json(cancelled)
  }

  // ── Reschedule to next available slot ───────────────────
  if (body.action === 'reschedule') {
    let newSlotId = body.slot_id

    if (!newSlotId) {
      const next = getNextAvailableSlotAfter(booking.slot_id)
      if (!next) return NextResponse.json({ error: 'No upcoming slots available' }, { status: 409 })
      if (next.booking_count >= next.max_bookings) {
        return NextResponse.json({ error: 'Next slot is full' }, { status: 409 })
      }
      newSlotId = next.id
    } else {
      const newSlot = getSlotById(newSlotId)
      if (!newSlot) return NextResponse.json({ error: 'Slot not found' }, { status: 404 })
      if (newSlot.booking_count >= newSlot.max_bookings) {
        return NextResponse.json({ error: 'Selected slot is full' }, { status: 409 })
      }
    }

    const updated = updateBookingSlot(id, newSlotId)
    const newSlot  = getSlotById(newSlotId)

    if (booking.outlook_event_id && outlookConfigured() && isOutlookConnected()) {
      try {
        await updateOutlookEvent(booking.outlook_event_id, {
          start: newSlot.start_time,
          end:   newSlot.end_time,
        })
      } catch (e) {
        console.error('Outlook update failed:', e.message)
      }
    }

    return NextResponse.json(updated)
  }

  return NextResponse.json({ error: 'Unknown action. Use "cancel" or "reschedule".' }, { status: 400 })
}

// DELETE /api/bookings/:id  — admin hard delete
export async function DELETE(_, { params }) {
  const { id } = await params
  const booking = getBookingById(id)
  if (!booking) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (booking.outlook_event_id && outlookConfigured() && isOutlookConnected()) {
    try { await deleteOutlookEvent(booking.outlook_event_id) } catch (e) { /* ignore */ }
  }
  cancelBooking(id)
  return new NextResponse(null, { status: 204 })
}
