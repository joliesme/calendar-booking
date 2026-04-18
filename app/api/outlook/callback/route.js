import { NextResponse } from 'next/server'
import { exchangeCode } from '@/lib/outlook.js'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const code  = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/admin/outlook?error=${encodeURIComponent(error)}`
    )
  }

  if (!code) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/admin/outlook?error=no_code`
    )
  }

  try {
    await exchangeCode(code)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/admin/outlook?connected=1`
    )
  } catch (err) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/admin/outlook?error=${encodeURIComponent(err.message)}`
    )
  }
}
