import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 10

interface RouteContext {
  params: Promise<{ projectId: string }>
}

/**
 * Get all translated text blocks for a project
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { projectId } = await context.params

    // Get all pages for this project
    const { data: pages, error: pagesError } = await supabaseAdmin
      .from('pages')
      .select('id, page_index')
      .eq('project_id', projectId)
      .order('page_index')

    if (pagesError) {
      return NextResponse.json({ error: pagesError.message }, { status: 500 })
    }

    if (!pages || pages.length === 0) {
      return NextResponse.json({ pages: [] })
    }

    // Get all text blocks for these pages
    const pageIds = pages.map((p) => p.id)

    const { data: textBlocks, error: blocksError } = await supabaseAdmin
      .from('text_blocks')
      .select('*')
      .in('page_id', pageIds)
      .order('page_id')

    if (blocksError) {
      return NextResponse.json({ error: blocksError.message }, { status: 500 })
    }

    // Group text blocks by page
    const pageMap = new Map(pages.map((p) => [p.id, p.page_index]))

    const groupedByPage = pages.map((page) => ({
      pageIndex: page.page_index,
      textBlocks: (textBlocks || [])
        .filter((block) => block.page_id === page.id)
        .map((block) => ({
          ocrText: block.ocr_text,
          translatedText: block.translated_text,
          bbox: block.bbox,
          confidence: block.confidence,
        })),
    }))

    return NextResponse.json({
      projectId,
      totalPages: pages.length,
      pages: groupedByPage,
    })
  } catch (error) {
    console.error('Failed to fetch translations:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch translations',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
