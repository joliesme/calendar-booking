import { NextResponse } from 'next/server'
import { getEventById, updateEvent, deleteEvent } from '@/lib/db.js'
import { requireAdmin } from '@/lib/auth.js'

export async function PATCH(request, { params }) {
  const deny = requireAdmin(request)
  if (deny) return deny
  const { id } = await params
  const body = await request.json()
  const event = await updateEvent(id, body)
  return NextResponse.json(event)
}

export async function DELETE(request, { params }) {
  const deny = requireAdmin(request)
  if (deny) return deny
  const { id } = await params
  await deleteEvent(id)
  return NextResponse.json({ ok: true })
}
