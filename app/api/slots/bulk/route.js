import { NextResponse } from 'next/server'
import { bulkDeleteSlots, bulkUpdateSlots } from '@/lib/db.js'
import { requireAdmin } from '@/lib/auth.js'

export async function POST(request) {
  const deny = requireAdmin(request)
  if (deny) return deny
  const body = await request.json()
  const { action, ids, ...fields } = body

  if (!Array.isArray(ids) || ids.length === 0)
    return NextResponse.json({ error: 'ids array required' }, { status: 400 })

  if (action === 'delete') {
    try {
      await bulkDeleteSlots(ids)
      return NextResponse.json({ deleted: ids.length })
    } catch (e) {
      console.error('bulk delete:', e)
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  if (action === 'update') {
    try {
      await bulkUpdateSlots(ids, fields)
      return NextResponse.json({ updated: ids.length })
    } catch (e) {
      console.error('bulk update:', e)
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'action must be "delete" or "update"' }, { status: 400 })
}
