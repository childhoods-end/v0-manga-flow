import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/credits - Get user's credit balance
export async function GET(request: NextRequest) {
  try {
    console.log('[Credits API] GET request received')

    // Verify user authentication via Supabase session
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('[Credits API] Unauthorized:', authError?.message)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = user.id
    console.log('[Credits API] Fetching credits for user:', userId)

    // Get user credits
    const { data: credits, error: creditsError } = await supabaseAdmin
      .from('user_credits')
      .select('*')
      .eq('user_id', userId)
      .single()

    console.log('[Credits API] Credits:', credits, 'Error:', creditsError)

    if (creditsError) {
      // If credits don't exist, create them
      if (creditsError.code === 'PGRST116') {
        console.log('[Credits API] Creating new credits for user:', userId)
        const { data: newCredits, error: createError } = await supabaseAdmin
          .from('user_credits')
          .insert({
            user_id: userId,
            total_credits: 100,
            used_credits: 0,
            remaining_credits: 100,
          })
          .select()
          .single()

        if (createError) {
          console.error('[Credits API] Error creating credits:', createError)
          return NextResponse.json({ error: createError.message }, { status: 500 })
        }

        return NextResponse.json(newCredits)
      }

      return NextResponse.json({ error: creditsError.message }, { status: 500 })
    }

    return NextResponse.json(credits)
  } catch (error) {
    console.error('[Credits API] Error fetching credits:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/credits - Deduct credits for translation
export async function POST(request: NextRequest) {
  try {
    console.log('[Credits API] POST request received')

    // Verify user authentication via Supabase session
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('[Credits API] Unauthorized:', authError?.message)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = user.id

    const body = await request.json()
    const { amount } = body

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    console.log('[Credits API] Deducting', amount, 'credits for user:', userId)

    // Get current credits
    const { data: credits, error: fetchError } = await supabaseAdmin
      .from('user_credits')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (fetchError) {
      console.error('[Credits API] Error fetching credits:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    // Check if user has enough credits
    if (credits.remaining_credits < amount) {
      console.log('[Credits API] Insufficient credits:', credits.remaining_credits, '<', amount)
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
      .eq('user_id', userId)
      .select()
      .single()

    if (updateError) {
      console.error('[Credits API] Error updating credits:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    console.log('[Credits API] Credits deducted successfully. New balance:', updatedCredits.remaining_credits)

    return NextResponse.json({
      success: true,
      credits: updatedCredits,
    })
  } catch (error) {
    console.error('[Credits API] Error deducting credits:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
