import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * Test email sending endpoint
 * Visit: /api/test-email?email=your@email.com
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')

  if (!email) {
    return NextResponse.json(
      { error: 'Missing email parameter. Usage: /api/test-email?email=your@email.com' },
      { status: 400 }
    )
  }

  try {
    console.log('Testing email send to:', email)

    // Method 1: Try to send magic link (doesn't require registration)
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
    })

    if (error) {
      console.error('Email test error:', error)
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          details: error,
          suggestion: 'Check Supabase SMTP configuration in Project Settings → Auth → SMTP Settings',
        },
        { status: 500 }
      )
    }

    console.log('Email test successful:', data)

    return NextResponse.json({
      success: true,
      message: `Test email sent to ${email}`,
      details: {
        email: email,
        actionLink: data.properties?.action_link,
        note: 'Check your inbox (and spam folder) for the email',
      },
    })
  } catch (error) {
    console.error('Email test exception:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        suggestion: 'Verify that SMTP is configured correctly in Supabase',
      },
      { status: 500 }
    )
  }
}
