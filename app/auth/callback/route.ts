import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

/**
 * Handle email confirmation callback from Supabase
 * This endpoint is called when user clicks the confirmation link in their email
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')
  const redirect_to = requestUrl.searchParams.get('redirect_to') || '/translate'

  console.log('Email confirmation callback:', { token_hash, type, redirect_to })

  if (token_hash && type) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      }
    )

    try {
      // Verify the OTP token
      const { error } = await supabase.auth.verifyOtp({
        type: type as any,
        token_hash,
      })

      if (error) {
        console.error('Email verification error:', error)
        return NextResponse.redirect(
          new URL(`/auth?error=verification_failed&message=${encodeURIComponent(error.message)}`, request.url)
        )
      }

      console.log('Email verification successful')

      // Successful verification - redirect to the app
      return NextResponse.redirect(new URL(redirect_to, request.url))
    } catch (error) {
      console.error('Email verification exception:', error)
      return NextResponse.redirect(
        new URL('/auth?error=verification_exception', request.url)
      )
    }
  }

  // Missing required parameters
  console.error('Missing token_hash or type parameter')
  return NextResponse.redirect(
    new URL('/auth?error=invalid_verification_link', request.url)
  )
}
