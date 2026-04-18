import { NextResponse } from 'next/server'

export function requireAdmin(request) {
  const cookie = request.cookies.get('admin_session')?.value
  if (cookie === process.env.ADMIN_PASSWORD) return null  // authorised
  return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
}

export function checkAdminPassword(password) {
  return password === process.env.ADMIN_PASSWORD
}
