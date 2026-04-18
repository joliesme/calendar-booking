import { NextResponse } from 'next/server'
import { lookupBookings } from '@/lib/db.js'

// POST /api/bookings/lookup  — public: find bookings by name + email
export async function POST(request) {
  const body = await request.json()
  const { name, email } = body
  if (!name || !email) {
    return NextResponse.json({ error: 'name and email are required' }, { status: 400 })
  }
  const bookings = lookupBookings(name, email)
  return NextResponse.json(bookings)
}
