import { NextResponse } from 'next/server'
import { getQuestions, createQuestion, updateQuestion, deleteQuestion } from '@/lib/db.js'
import { requireAdmin } from '@/lib/auth.js'

// GET /api/questions  — public (returns active questions for the booking form)
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const all = searchParams.get('all') === 'true'
  if (all) {
    const deny = requireAdmin(request)
    if (deny) return deny
    return NextResponse.json(getQuestions({ activeOnly: false }))
  }
  return NextResponse.json(getQuestions({ activeOnly: true }))
}

// POST /api/questions  — admin: create a question
export async function POST(request) {
  const deny = requireAdmin(request)
  if (deny) return deny
  const body = await request.json()
  if (!body.label) return NextResponse.json({ error: 'label is required' }, { status: 400 })
  const q = createQuestion(body)
  return NextResponse.json(q, { status: 201 })
}

// PUT /api/questions  — admin: update a question
export async function PUT(request) {
  const deny = requireAdmin(request)
  if (deny) return deny
  const body = await request.json()
  if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  updateQuestion(body.id, body)
  return NextResponse.json({ ok: true })
}

// DELETE /api/questions?id=xxx  — admin
export async function DELETE(request) {
  const deny = requireAdmin(request)
  if (deny) return deny
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  deleteQuestion(id)
  return new NextResponse(null, { status: 204 })
}
