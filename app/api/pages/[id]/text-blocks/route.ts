import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * Get all text blocks for a page
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pageId = params.id

    const { data: textBlocks, error } = await supabaseAdmin
      .from('text_blocks')
      .select('*')
      .eq('page_id', pageId)
      .order('created_at')

    if (error) {
      console.error('Failed to get text blocks:', error)
      return NextResponse.json({ error: 'Failed to get text blocks' }, { status: 500 })
    }

    return NextResponse.json({ textBlocks: textBlocks || [] })
  } catch (error) {
    console.error('Failed to get text blocks:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
