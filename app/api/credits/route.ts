import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// GET /api/credits - Get user's credit balance
export async function GET(request: NextRequest) {
  try {
    console.log('[Credits API] GET request received')

    // Get session from cookies
    const cookieStore = await cookies()
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    console.log('[Credits API] User:', user?.id, 'Auth error:', authError)

    if (authError || !user) {
      console.error('[Credits API] Unauthorized')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user credits
    console.log('[Credits API] Fetching credits for user:', user.id)
    const { data: credits, error: creditsError } = await supabaseAdmin
      .from('user_credits')
      .select('*')
      .eq('user_id', user.id)
      .single()

    console.log('[Credits API] Credits:', credits, 'Error:', creditsError)

    if (creditsError) {
      // If credits don't exist, create them
      if (creditsError.code === 'PGRST116') {
        const { data: newCredits, error: createError } = await supabaseAdmin
          .from('user_credits')
          .insert({
            user_id: user.id,
            total_credits: 100,
            used_credits: 0,
            remaining_credits: 100,
          })
          .select()
          .single()

        if (createError) {
          return NextResponse.json({ error: createError.message }, { status: 500 })
        }

        return NextResponse.json(newCredits)
      }

      return NextResponse.json({ error: creditsError.message }, { status: 500 })
    }

    return NextResponse.json(credits)
  } catch (error) {
    console.error('Error fetching credits:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/credits - Deduct credits for translation
export async function POST(request: NextRequest) {
  try {
    // Get session from cookies
    const cookieStore = await cookies()
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { amount } = await request.json()

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    // Get current credits
    const { data: credits, error: fetchError } = await supabaseAdmin
      .from('user_credits')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    // Check if user has enough credits
    if (credits.remaining_credits < amount) {
      return NextResponse.json(
        {
          error: 'Insufficient credits',
          remaining: credits.remaining_credits,
          required: amount,
        },
        { status: 402 }
      )
    }

    // Deduct credits
    const { data: updatedCredits, error: updateError } = await supabaseAdmin
      .from('user_credits')
      .update({
        used_credits: credits.used_credits + amount,
      })
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      credits: updatedCredits,
    })
  } catch (error) {
    console.error('Error deducting credits:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
