import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Test worker endpoint to verify basic functionality
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[Test Worker] Starting...')

    const body = await request.json()
    const { jobId } = body

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 })
    }

    console.log('[Test Worker] Processing job:', jobId)

    // Get job
    const { data: job, error: jobError } = await supabaseAdmin
      .from('translation_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      console.error('[Test Worker] Job not found:', jobError)
      return NextResponse.json({ error: 'Job not found', details: jobError }, { status: 404 })
    }

    console.log('[Test Worker] Job found:', {
      id: job.id,
      status: job.status,
      currentPage: job.current_page,
      totalPages: job.total_pages,
    })

    // Get project
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', job.project_id)
      .single()

    if (projectError || !project) {
      console.error('[Test Worker] Project not found:', projectError)
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    console.log('[Test Worker] Project found:', {
      id: project.id,
      title: project.title,
      sourceLang: project.source_language,
      targetLang: project.target_language,
    })

    // Get pages
    const { data: pages, error: pagesError } = await supabaseAdmin
      .from('pages')
      .select('*')
      .eq('project_id', job.project_id)
      .order('page_index')

    if (pagesError || !pages || pages.length === 0) {
      console.error('[Test Worker] No pages found:', pagesError)
      return NextResponse.json({ error: 'No pages found' }, { status: 404 })
    }

    console.log(`[Test Worker] Found ${pages.length} pages`)

    return NextResponse.json({
      success: true,
      message: 'Test worker completed successfully',
      job: {
        id: job.id,
        status: job.status,
        progress: job.progress || 0,
      },
      project: {
        id: project.id,
        title: project.title,
      },
      pagesCount: pages.length,
      nextPage: job.current_page || 0,
    })
  } catch (error) {
    console.error('[Test Worker] Error:', error)
    return NextResponse.json(
      {
        error: 'Test worker failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}
