import { NextResponse } from 'next/server'
import { reorderQuestions } from '@/lib/db.js'
import { requireAdmin } from '@/lib/auth.js'

export async function POST(request) {
  const deny = requireAdmin(request)
  if (deny) return deny
  const { ids } = await request.json()
  if (!Array.isArray(ids)) return NextResponse.json({ error: 'ids must be an array' }, { status: 400 })
  await reorderQuestions(ids)
  return NextResponse.json({ ok: true })
}
