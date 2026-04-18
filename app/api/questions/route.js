import { NextResponse } from 'next/server'
import { getQuestions, createQuestion, updateQuestion, deleteQuestion } from '@/lib/db.js'
import { requireAdmin } from '@/lib/auth.js'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const all = searchParams.get('all') === 'true'
  if (all) {
    const deny = requireAdmin(request)
    if (deny) return deny
    return NextResponse.json(await getQuestions({ activeOnly: false }))
  }
  return NextResponse.json(await getQuestions({ activeOnly: true }))
}

export async function POST(request) {
  const deny = requireAdmin(request)
  if (deny) return deny
  const body = await request.json()
  if (!body.label) return NextResponse.json({ error: 'label is required' }, { status: 400 })
  const q = await createQuestion(body)
  return NextResponse.json(q, { status: 201 })
}

export async function PUT(request) {
  const deny = requireAdmin(request)
  if (deny) return deny
  const body = await request.json()
  if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  await updateQuestion(body.id, body)
  return NextResponse.json({ ok: true })
}

export async function DELETE(request) {
  const deny = requireAdmin(request)
  if (deny) return deny
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await deleteQuestion(id)
  return new NextResponse(null, { status: 204 })
}
