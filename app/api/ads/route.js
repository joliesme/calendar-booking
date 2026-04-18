import { NextResponse } from 'next/server'
import { getAds, createAd, updateAd, deleteAd } from '@/lib/db.js'
import { requireAdmin } from '@/lib/auth.js'

// GET /api/ads?position=sidebar  — public
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const position  = searchParams.get('position') || undefined
  const adminAll  = searchParams.get('all') === 'true'
  if (adminAll) {
    const deny = requireAdmin(request)
    if (deny) return deny
    return NextResponse.json(getAds({ activeOnly: false }))
  }
  return NextResponse.json(getAds({ position, activeOnly: true }))
}

// POST /api/ads  — admin
export async function POST(request) {
  const deny = requireAdmin(request)
  if (deny) return deny
  const body = await request.json()
  if (!body.title) return NextResponse.json({ error: 'title is required' }, { status: 400 })
  const ad = createAd(body)
  return NextResponse.json(ad, { status: 201 })
}

// PUT /api/ads  — admin
export async function PUT(request) {
  const deny = requireAdmin(request)
  if (deny) return deny
  const body = await request.json()
  if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  updateAd(body.id, body)
  return NextResponse.json({ ok: true })
}

// DELETE /api/ads?id=xxx  — admin
export async function DELETE(request) {
  const deny = requireAdmin(request)
  if (deny) return deny
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  deleteAd(id)
  return new NextResponse(null, { status: 204 })
}
