import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * Debug endpoint to check project status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const projectId = params.projectId

    // Get project
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get pages
    const { data: pages, error: pagesError } = await supabaseAdmin
      .from('pages')
      .select('*')
      .eq('project_id', projectId)
      .order('page_index')

    if (pagesError) {
      return NextResponse.json({ error: 'Failed to get pages' }, { status: 500 })
    }

    // Get text blocks for each page
    const pagesWithBlocks = await Promise.all(
      (pages || []).map(async (page) => {
        const { data: blocks } = await supabaseAdmin
          .from('text_blocks')
          .select('*')
          .eq('page_id', (page as any).id)

        return {
          pageId: (page as any).id,
          pageIndex: (page as any).page_index,
          hasOriginal: !!(page as any).original_blob_url,
          hasProcessed: !!(page as any).processed_blob_url,
          processedUrl: (page as any).processed_blob_url,
          blockCount: blocks?.length || 0,
          translatedCount: blocks?.filter((b: any) => b.translated_text).length || 0,
          blocks: blocks?.map((b: any) => ({
            id: b.id,
            hasOcr: !!b.ocr_text,
            hasTranslation: !!b.translated_text,
            fontSize: b.font_size,
            status: b.status,
          })),
        }
      })
    )

    return NextResponse.json({
      project: {
        id: (project as any).id,
        title: (project as any).title,
        status: (project as any).status,
        sourceLanguage: (project as any).source_language,
        targetLanguage: (project as any).target_language,
      },
      pages: pagesWithBlocks,
      summary: {
        totalPages: pages?.length || 0,
        pagesWithProcessed: pages?.filter((p: any) => p.processed_blob_url).length || 0,
        pagesMissingProcessed: pages?.filter((p: any) => !p.processed_blob_url).length || 0,
      },
    })
  } catch (error) {
    console.error('Debug failed:', error)
    return NextResponse.json({
      error: 'Debug failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
