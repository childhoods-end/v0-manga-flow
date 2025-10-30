import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * Get all text blocks and speech bubbles for a page
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pageId = params.id

    // Fetch text blocks
    const { data: textBlocks, error: textBlocksError } = await supabaseAdmin
      .from('text_blocks')
      .select('*')
      .eq('page_id', pageId)
      .order('created_at')

    if (textBlocksError) {
      console.error('Failed to get text blocks:', textBlocksError)
      return NextResponse.json({ error: 'Failed to get text blocks' }, { status: 500 })
    }

    // Fetch speech bubbles
    const { data: speechBubbles, error: bubblesError } = await supabaseAdmin
      .from('speech_bubbles')
      .select('*')
      .eq('page_id', pageId)
      .order('created_at')

    if (bubblesError) {
      console.error('Failed to get speech bubbles:', bubblesError)
      // Don't fail the request if bubbles don't exist, just return empty array
    }

    return NextResponse.json({
      textBlocks: textBlocks || [],
      speechBubbles: speechBubbles || []
    })
  } catch (error) {
    console.error('Failed to get text blocks:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
