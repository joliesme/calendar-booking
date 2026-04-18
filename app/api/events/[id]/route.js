import { NextResponse } from 'next/server'
import { getEventById, updateEvent, deleteEvent } from '@/lib/db.js'
import { requireAdmin } from '@/lib/auth.js'

// PATCH /api/events/[id]
export async function PATCH(request, { params }) {
  const deny = requireAdmin(request)
  if (deny) return deny
  const { id } = await params
  const body = await request.json()
  updateEvent(id, body)
  return NextResponse.json(getEventById(id))
}

// DELETE /api/events/[id]
export async function DELETE(request, { params }) {
  const deny = requireAdmin(request)
  if (deny) return deny
  const { id } = await params
  deleteEvent(id)
  return NextResponse.json({ ok: true })
}
