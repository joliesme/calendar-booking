import { NextResponse } from 'next/server'
import { getSlots, getAllSlots, createSlot, bulkCreateSlots, bulkDeleteSlots, bulkUpdateSlots } from '@/lib/db.js'
import { requireAdmin } from '@/lib/auth.js'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const all = searchParams.get('all') === 'true'
  const available = searchParams.get('available') === 'true'

  if (all) {
    const deny = requireAdmin(request)
    if (deny) return deny
    return NextResponse.json(await getAllSlots())
  }

  return NextResponse.json(await getSlots({ onlyAvailable: available }))
}

export async function POST(request) {
  const deny = requireAdmin(request)
  if (deny) return deny

  const body = await request.json()

  if (body.bulk) {
    const { dates, startHour = 9, endHour = 17, duration = 30, buffer = 0, max_bookings = 1, event_id = null } = body
    const step = duration + (buffer || 0)
    const slots = []
    for (const date of dates) {
      let current = startHour * 60
      const end   = endHour   * 60
      while (current + duration <= end) {
        const pad = (n) => String(n).padStart(2, '0')
        const sh = pad(Math.floor(current / 60)), sm = pad(current % 60)
        const eh = pad(Math.floor((current + duration) / 60)), em = pad((current + duration) % 60)
        slots.push({ start_time: `${date}T${sh}:${sm}:00`, end_time: `${date}T${eh}:${em}:00`, max_bookings, event_id })
        current += step
      }
    }
    await bulkCreateSlots(slots)
    return NextResponse.json({ created: slots.length }, { status: 201 })
  }

  const { start_time, end_time, max_bookings = 1, event_id = null } = body
  if (!start_time || !end_time)
    return NextResponse.json({ error: 'start_time and end_time required' }, { status: 400 })

  const slot = await createSlot({ start_time, end_time, max_bookings, event_id })
  return NextResponse.json(slot, { status: 201 })
}

export async function PATCH(request) {
  const deny = requireAdmin(request)
  if (deny) return deny
  const { ids, ...fields } = await request.json()
  if (!Array.isArray(ids) || ids.length === 0)
    return NextResponse.json({ error: 'ids array required' }, { status: 400 })
  await bulkUpdateSlots(ids, fields)
  return NextResponse.json({ updated: ids.length })
}

export async function DELETE(request) {
  const deny = requireAdmin(request)
  if (deny) return deny
  const { ids } = await request.json()
  if (!Array.isArray(ids) || ids.length === 0)
    return NextResponse.json({ error: 'ids array required' }, { status: 400 })
  await bulkDeleteSlots(ids)
  return NextResponse.json({ deleted: ids.length })
}
