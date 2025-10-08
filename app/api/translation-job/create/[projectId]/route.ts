import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 10

interface RouteContext {
  params: Promise<{
    projectId: string
  }>
}

/**
 * Create a translation job for background processing
 * Returns immediately without waiting for translation
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const { projectId } = await context.params

  try {
    console.log('Creating translation job for project:', projectId)

    // Get project and pages
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    const { data: pages } = await supabaseAdmin
      .from('pages')
      .select('id')
      .eq('project_id', projectId)

    const totalPages = pages?.length || 0

    if (totalPages === 0) {
      return NextResponse.json(
        { error: 'No pages found' },
        { status: 404 }
      )
    }

    // Check if job already exists
    const { data: existingJob } = await supabaseAdmin
      .from('translation_jobs')
      .select('*')
      .eq('project_id', projectId)
      .single()

    let job

    if (existingJob && existingJob.status === 'processing') {
      // Job already processing
      return NextResponse.json({
        jobId: existingJob.id,
        status: 'processing',
        message: 'Translation job already in progress',
        progress: existingJob.progress || 0,
      })
    } else if (existingJob) {
      // Update existing job
      const { data: updatedJob, error: updateError } = await supabaseAdmin
        .from('translation_jobs')
        .update({
          status: 'pending',
          progress: 0,
          current_page: 0,
          total_pages: totalPages,
          error_message: null,
          started_at: null,
          completed_at: null,
        })
        .eq('id', existingJob.id)
        .select()
        .single()

      if (updateError) {
        throw updateError
      }
      job = updatedJob
    } else {
      // Create new job
      const { data: newJob, error: createError } = await supabaseAdmin
        .from('translation_jobs')
        .insert({
          project_id: projectId,
          status: 'pending',
          total_pages: totalPages,
        })
        .select()
        .single()

      if (createError) {
        throw createError
      }
      job = newJob
    }

    // Update project status
    await supabaseAdmin
      .from('projects')
      .update({ status: 'processing' })
      .eq('id', projectId)

    // Trigger worker (in production, this would be a queue system)
    // For now, we'll use a simple HTTP call to the worker endpoint
    try {
      const workerUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/translation-job/worker`
      fetch(workerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id }),
      }).catch(err => console.error('Failed to trigger worker:', err))
    } catch (err) {
      console.error('Failed to trigger worker:', err)
    }

    return NextResponse.json({
      success: true,
      jobId: job.id,
      projectId,
      totalPages,
      status: 'pending',
      message: 'Translation job created. Processing will start shortly.',
    })
  } catch (error) {
    console.error('Failed to create translation job:', error)
    return NextResponse.json(
      {
        error: 'Failed to create translation job',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
