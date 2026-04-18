import { NextResponse } from 'next/server'
import { getAuthUrl, outlookConfigured } from '@/lib/outlook.js'
import { requireAdmin } from '@/lib/auth.js'

export async function GET(request) {
  const deny = requireAdmin(request)
  if (deny) return deny

  if (!outlookConfigured()) {
    return NextResponse.json(
      { error: 'OUTLOOK_CLIENT_ID and OUTLOOK_CLIENT_SECRET are not configured in .env.local' },
      { status: 501 }
    )
  }

  return NextResponse.redirect(getAuthUrl())
}
