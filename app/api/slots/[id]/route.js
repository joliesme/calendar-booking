import { NextResponse } from 'next/server'
import { getSlotById, updateSlot, deleteSlot } from '@/lib/db.js'
import { requireAdmin } from '@/lib/auth.js'

export async function GET(_, { params }) {
  const { id } = await params
  const slot = await getSlotById(id)
  if (!slot) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(slot)
}

export async function PATCH(request, { params }) {
  const deny = requireAdmin(request)
  if (deny) return deny
  const { id } = await params
  try {
    const body = await request.json()
    const slot = await updateSlot(id, body)
    return NextResponse.json(slot)
  } catch (e) {
    console.error('PATCH /api/slots/[id]:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  const deny = requireAdmin(request)
  if (deny) return deny
  const { id } = await params
  try {
    await deleteSlot(id)
    return new NextResponse(null, { status: 204 })
  } catch (e) {
    console.error('DELETE /api/slots/[id]:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
