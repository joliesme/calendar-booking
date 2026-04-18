import { NextResponse } from 'next/server'
import { getEvents, createEvent } from '@/lib/db.js'
import { requireAdmin } from '@/lib/auth.js'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const all = searchParams.get('all') === 'true'
  if (all) {
    const deny = requireAdmin(request)
    if (deny) return deny
    return NextResponse.json(await getEvents({ activeOnly: false }))
  }
  return NextResponse.json(await getEvents({ activeOnly: true }))
}

export async function POST(request) {
  const deny = requireAdmin(request)
  if (deny) return deny
  const body = await request.json()
  if (!body.name) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  const event = await createEvent(body)
  return NextResponse.json(event, { status: 201 })
}
