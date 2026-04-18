import { NextResponse } from 'next/server'
import { reorderQuestions } from '@/lib/db.js'
import { requireAdmin } from '@/lib/auth.js'

// POST /api/questions/reorder  { ids: ['id1', 'id2', ...] }
export async function POST(request) {
  const deny = requireAdmin(request)
  if (deny) return deny
  const { ids } = await request.json()
  if (!Array.isArray(ids)) return NextResponse.json({ error: 'ids must be an array' }, { status: 400 })
  reorderQuestions(ids)
  return NextResponse.json({ ok: true })
}
