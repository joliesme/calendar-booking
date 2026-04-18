import { NextResponse } from 'next/server'
import { isOutlookConnected, outlookConfigured } from '@/lib/outlook.js'
import { requireAdmin } from '@/lib/auth.js'

export async function GET(request) {
  const deny = requireAdmin(request)
  if (deny) return deny

  if (!outlookConfigured()) {
    return NextResponse.json({ status: 'unconfigured' })
  }
  return NextResponse.json({ status: isOutlookConnected() ? 'connected' : 'disconnected' })
}
