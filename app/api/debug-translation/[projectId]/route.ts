import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ projectId: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { projectId } = await context.params

    // Get project
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (projectError) {
      return NextResponse.json({ error: 'Project not found', details: projectError }, { status: 404 })
    }

    // Get pages
    const { data: pages, error: pagesError } = await supabaseAdmin
      .from('pages')
      .select('*')
      .eq('project_id', projectId)
      .order('page_index')

    if (pagesError) {
      return NextResponse.json({ error: 'Failed to get pages', details: pagesError }, { status: 500 })
    }

    // Get text blocks for each page
    const pagesWithBlocks = []
    for (const page of pages || []) {
      const { data: textBlocks, error: blocksError } = await supabaseAdmin
        .from('text_blocks')
        .select('*')
        .eq('page_id', page.id)

      pagesWithBlocks.push({
        page_index: page.page_index,
        page_id: page.id,
        text_blocks_count: textBlocks?.length || 0,
        text_blocks: textBlocks || [],
        error: blocksError?.message,
      })
    }

    // Check if text_blocks table exists
    const { data: tables, error: tablesError } = await supabaseAdmin
      .from('text_blocks')
      .select('*')
      .limit(1)

    return NextResponse.json({
      project: {
        id: project.id,
        title: project.title,
        status: project.status,
        source_language: project.source_language,
        target_language: project.target_language,
      },
      pages_count: pages?.length || 0,
      text_blocks_table_exists: !tablesError,
      text_blocks_table_error: tablesError?.message,
      pages_with_blocks: pagesWithBlocks,
      total_text_blocks: pagesWithBlocks.reduce((sum, p) => sum + p.text_blocks_count, 0),
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Debug failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
