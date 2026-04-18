import { NextResponse } from 'next/server'
import { getAds, createAd, updateAd, deleteAd } from '@/lib/db.js'
import { requireAdmin } from '@/lib/auth.js'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const position  = searchParams.get('position') || undefined
  const adminAll  = searchParams.get('all') === 'true'
  if (adminAll) {
    const deny = requireAdmin(request)
    if (deny) return deny
    return NextResponse.json(await getAds({ activeOnly: false }))
  }
  return NextResponse.json(await getAds({ position, activeOnly: true }))
}

export async function POST(request) {
  const deny = requireAdmin(request)
  if (deny) return deny
  const body = await request.json()
  if (!body.title) return NextResponse.json({ error: 'title is required' }, { status: 400 })
  const ad = await createAd(body)
  return NextResponse.json(ad, { status: 201 })
}

export async function PUT(request) {
  const deny = requireAdmin(request)
  if (deny) return deny
  const body = await request.json()
  if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  await updateAd(body.id, body)
  return NextResponse.json({ ok: true })
}

export async function DELETE(request) {
  const deny = requireAdmin(request)
  if (deny) return deny
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await deleteAd(id)
  return new NextResponse(null, { status: 204 })
}
