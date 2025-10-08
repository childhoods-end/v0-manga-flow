import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{
    projectId: string
  }>
}

/**
 * Get translation job status for a project
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { projectId } = await context.params

    const { data: job, error } = await supabaseAdmin
      .from('translation_jobs')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !job) {
      return NextResponse.json({
        exists: false,
        status: 'none',
      })
    }

    return NextResponse.json({
      exists: true,
      jobId: job.id,
      status: job.status,
      progress: job.progress || 0,
      currentPage: job.current_page || 0,
      totalPages: job.total_pages || 0,
      errorMessage: job.error_message,
      startedAt: job.started_at,
      completedAt: job.completed_at,
      createdAt: job.created_at,
    })
  } catch (error) {
    console.error('Failed to get job status:', error)
    return NextResponse.json(
      {
        error: 'Failed to get job status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
