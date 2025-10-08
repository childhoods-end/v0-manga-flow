import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ projectId: string }>
}

/**
 * Reset project status to pending and clear text blocks
 * This allows re-running translation
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { projectId } = await context.params

    // Delete existing text blocks
    const { error: deleteError } = await supabaseAdmin
      .from('text_blocks')
      .delete()
      .in('page_id',
        supabaseAdmin
          .from('pages')
          .select('id')
          .eq('project_id', projectId)
      )

    if (deleteError) {
      console.error('Failed to delete text blocks:', deleteError)
    }

    // Reset project status to pending
    const { data: project, error: updateError } = await supabaseAdmin
      .from('projects')
      .update({ status: 'pending', processed_pages: 0 })
      .eq('id', projectId)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to reset project', details: updateError },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Project reset to pending status',
      project,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Reset failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
