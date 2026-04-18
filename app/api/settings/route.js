import { NextResponse } from 'next/server'
import { getSetting, setSetting } from '@/lib/db.js'
import { requireAdmin } from '@/lib/auth.js'

const PUBLIC_KEYS = [] // keys readable without auth (none currently)
const ADMIN_KEYS  = ['allow_duplicate_bookings']

export async function GET(request) {
  const deny = requireAdmin(request)
  if (deny) return deny
  const result = {}
  for (const key of ADMIN_KEYS) result[key] = getSetting(key) ?? null
  return NextResponse.json(result)
}

export async function POST(request) {
  const deny = requireAdmin(request)
  if (deny) return deny
  const body = await request.json()
  for (const [key, val] of Object.entries(body)) {
    if (ADMIN_KEYS.includes(key)) setSetting(key, String(val))
  }
  return NextResponse.json({ ok: true })
}
