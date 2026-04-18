import { NextResponse } from 'next/server'
import { lookupBookings } from '@/lib/db.js'

export async function POST(request) {
  const body = await request.json()
  const { name, email } = body
  if (!name || !email)
    return NextResponse.json({ error: 'name and email are required' }, { status: 400 })
  const bookings = await lookupBookings(name, email)
  return NextResponse.json(bookings)
}
