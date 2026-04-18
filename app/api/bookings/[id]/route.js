import { NextResponse } from 'next/server'
import {
  getBookingById, cancelBooking, updateBookingSlot,
  updateBookingOutlookId, getSlotById, getNextAvailableSlotAfter
} from '@/lib/db.js'
import {
  deleteOutlookEvent, updateOutlookEvent, isOutlookConnected, outlookConfigured
} from '@/lib/outlook.js'

export async function GET(_, { params }) {
  const { id } = await params
  const booking = await getBookingById(id)
  if (!booking) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(booking)
}

export async function PATCH(request, { params }) {
  const { id } = await params
  const booking = await getBookingById(id)
  if (!booking) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (booking.status === 'cancelled')
    return NextResponse.json({ error: 'Booking is already cancelled' }, { status: 409 })

  const body = await request.json()

  if (body.action === 'cancel') {
    const cancelled = await cancelBooking(id)
    if (booking.outlook_event_id && outlookConfigured() && isOutlookConnected()) {
      try { await deleteOutlookEvent(booking.outlook_event_id) } catch (e) {
        console.error('Outlook delete failed:', e.message)
      }
    }
    return NextResponse.json(cancelled)
  }

  if (body.action === 'reschedule') {
    let newSlotId = body.slot_id

    if (!newSlotId) {
      const next = await getNextAvailableSlotAfter(booking.slot_id)
      if (!next) return NextResponse.json({ error: 'No upcoming slots available' }, { status: 409 })
      if (next.booking_count >= next.max_bookings)
        return NextResponse.json({ error: 'Next slot is full' }, { status: 409 })
      newSlotId = next.id
    } else {
      const newSlot = await getSlotById(newSlotId)
      if (!newSlot) return NextResponse.json({ error: 'Slot not found' }, { status: 404 })
      if (newSlot.booking_count >= newSlot.max_bookings)
        return NextResponse.json({ error: 'Selected slot is full' }, { status: 409 })
    }

    const updated  = await updateBookingSlot(id, newSlotId)
    const newSlot  = await getSlotById(newSlotId)

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

export async function DELETE(_, { params }) {
  const { id } = await params
  const booking = await getBookingById(id)
  if (!booking) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (booking.outlook_event_id && outlookConfigured() && isOutlookConnected()) {
    try { await deleteOutlookEvent(booking.outlook_event_id) } catch (e) { /* ignore */ }
  }
  await cancelBooking(id)
  return new NextResponse(null, { status: 204 })
}
