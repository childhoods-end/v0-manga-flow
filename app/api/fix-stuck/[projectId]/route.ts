import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{
    projectId: string
  }>
}

/**
 * Diagnose and fix stuck translation jobs
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { projectId } = await context.params

    console.log(`\n🔍 Diagnosing project: ${projectId}\n`)

    // 1. Get project info
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    console.log('📦 Project:', {
      title: project.title,
      status: project.status,
      processed_pages: project.processed_pages,
    })

    // 2. Get translation job
    const { data: jobs } = await supabaseAdmin
      .from('translation_jobs')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    console.log(`📋 Found ${jobs?.length || 0} translation jobs`)

    const currentJob = jobs?.[0]

    if (!currentJob) {
      return NextResponse.json({
        error: 'No translation job found',
        suggestion: 'Create a new translation job',
      }, { status: 404 })
    }

    // 3. Get pages
    const { data: pages } = await supabaseAdmin
      .from('pages')
      .select('*')
      .eq('project_id', projectId)
      .order('page_index')

    console.log(`📄 Found ${pages?.length || 0} pages`)

    const totalPages = pages?.length || 0
    const currentPage = currentJob.current_page || 0

    // 4. Analyze each page
    const pageAnalysis = []
    for (const page of pages || []) {
      const { data: blocks } = await supabaseAdmin
        .from('text_blocks')
        .select('id, status')
        .eq('page_id', page.id)

      const metadata = page.metadata || {}
      const hasError = metadata.page_error || metadata.ocr_error || metadata.render_error || metadata.upload_error

      pageAnalysis.push({
        page_index: page.page_index,
        has_processed: !!page.processed_blob_url,
        has_error: !!hasError,
        error_type: hasError ? (metadata.page_error ? 'page' : metadata.ocr_error ? 'ocr' : metadata.render_error ? 'render' : 'upload') : null,
        error_message: hasError,
        text_blocks: blocks?.length || 0,
        timing: metadata.stage_timing || null,
      })
    }

    // 5. Determine action
    let action = null
    let fixed = false

    if (currentJob.status === 'processing' && currentPage < totalPages) {
      const stuckPage = pages?.[currentPage]

      if (stuckPage) {
        const metadata = stuckPage.metadata || {}

        if (metadata.page_error || metadata.ocr_error) {
          console.log(`⚠️ Page ${currentPage + 1} has error, skipping...`)

          // Skip this page
          const newCurrentPage = currentPage + 1
          const progress = Math.round((newCurrentPage / totalPages) * 100)

          await supabaseAdmin
            .from('translation_jobs')
            .update({
              current_page: newCurrentPage,
              progress,
            })
            .eq('id', currentJob.id)

          action = `Skipped failed page ${currentPage + 1}, moved to page ${newCurrentPage}`
          fixed = true

          // Check if job should be completed
          if (newCurrentPage >= totalPages) {
            await supabaseAdmin
              .from('translation_jobs')
              .update({
                status: 'completed',
                progress: 100,
                completed_at: new Date().toISOString(),
              })
              .eq('id', currentJob.id)

            await supabaseAdmin
              .from('projects')
              .update({
                status: 'ready',
                processed_pages: totalPages,
              })
              .eq('id', projectId)

            action += ' and marked job as completed'
          }
        } else {
          action = `Page ${currentPage + 1} has no error. Worker needs to be triggered.`
        }
      }
    } else if (currentJob.status === 'completed') {
      action = 'Job already completed'
    } else if (currentPage >= totalPages) {
      // Job is at the end but not marked as completed
      await supabaseAdmin
        .from('translation_jobs')
        .update({
          status: 'completed',
          progress: 100,
          completed_at: new Date().toISOString(),
        })
        .eq('id', currentJob.id)

      await supabaseAdmin
        .from('projects')
        .update({
          status: 'ready',
          processed_pages: totalPages,
        })
        .eq('id', projectId)

      action = 'Marked job as completed (all pages processed)'
      fixed = true
    }

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        title: project.title,
        status: project.status,
      },
      job: {
        id: currentJob.id,
        status: currentJob.status,
        current_page: currentJob.current_page,
        total_pages: totalPages,
        progress: currentJob.progress,
      },
      pages: pageAnalysis,
      action,
      fixed,
      next_step: fixed && currentPage + 1 < totalPages
        ? `Trigger worker: POST /api/translation-job/trigger/${currentJob.id}`
        : null,
    })
  } catch (error) {
    console.error('Fix failed:', error)
    return NextResponse.json(
      {
        error: 'Fix failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * Get diagnosis without fixing
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { projectId } = await context.params

    // Get project
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get job
    const { data: jobs } = await supabaseAdmin
      .from('translation_jobs')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    const currentJob = jobs?.[0]

    // Get pages
    const { data: pages } = await supabaseAdmin
      .from('pages')
      .select('*')
      .eq('project_id', projectId)
      .order('page_index')

    // Analyze pages
    const pageAnalysis = []
    for (const page of pages || []) {
      const { data: blocks } = await supabaseAdmin
        .from('text_blocks')
        .select('id, status')
        .eq('page_id', page.id)

      const metadata = page.metadata || {}
      const hasError = metadata.page_error || metadata.ocr_error || metadata.render_error || metadata.upload_error

      pageAnalysis.push({
        page_index: page.page_index,
        has_processed: !!page.processed_blob_url,
        has_error: !!hasError,
        error: hasError || null,
        text_blocks: blocks?.length || 0,
      })
    }

    return NextResponse.json({
      project: {
        id: project.id,
        title: project.title,
        status: project.status,
        processed_pages: project.processed_pages,
      },
      job: currentJob ? {
        id: currentJob.id,
        status: currentJob.status,
        current_page: currentJob.current_page,
        total_pages: pages?.length || 0,
        progress: currentJob.progress,
      } : null,
      pages: pageAnalysis,
    })
  } catch (error) {
    console.error('Diagnosis failed:', error)
    return NextResponse.json(
      {
        error: 'Diagnosis failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
