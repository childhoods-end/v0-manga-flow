import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Handle email confirmation callback from Supabase
 * This endpoint is called when user clicks the confirmation link in their email
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')
  const next = requestUrl.searchParams.get('next') ?? '/translate'

  console.log('Email confirmation callback:', { token_hash, type, next })

  if (token_hash && type) {
    const cookieStore = await cookies()

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          flowType: 'pkce',
        },
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: '', ...options })
          },
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
      return NextResponse.redirect(new URL(next, request.url))
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
