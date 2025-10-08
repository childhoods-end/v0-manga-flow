import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 10

/**
 * Cron job that runs every minute to process pending translation jobs
 * This is triggered by Vercel Cron Jobs
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[Cron] Checking for pending translation jobs...')

    // Note: Removed CRON_SECRET check for easier testing
    // In production, add CRON_SECRET env var for security

    // Find pending or processing jobs
    const { data: jobs, error } = await supabaseAdmin
      .from('translation_jobs')
      .select('*')
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: true })
      .limit(5) // Process up to 5 jobs

    if (error) {
      console.error('[Cron] Error fetching jobs:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!jobs || jobs.length === 0) {
      console.log('[Cron] No pending jobs found')
      return NextResponse.json({ message: 'No pending jobs', processed: 0 })
    }

    console.log(`[Cron] Found ${jobs.length} job(s) to process`)

    const results = []

    // Process each job
    for (const job of jobs) {
      try {
        console.log(`[Cron] Triggering worker for job ${job.id}`)

        // Call worker endpoint - use Vercel URL or localhost for development
        const baseUrl = process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

        const workerUrl = `${baseUrl}/api/translation-job/worker`
        console.log(`[Cron] Worker URL: ${workerUrl}`)

        const response = await fetch(workerUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: job.id }),
        })

        const result = await response.json()

        results.push({
          jobId: job.id,
          status: response.ok ? 'triggered' : 'failed',
          result,
        })

        console.log(`[Cron] Worker triggered for job ${job.id}:`, result)
      } catch (jobError) {
        console.error(`[Cron] Failed to trigger worker for job ${job.id}:`, jobError)
        results.push({
          jobId: job.id,
          status: 'error',
          error: jobError instanceof Error ? jobError.message : 'Unknown error',
        })
      }
    }

    return NextResponse.json({
      success: true,
      processed: jobs.length,
      results,
    })
  } catch (error) {
    console.error('[Cron] Cron job failed:', error)
    return NextResponse.json(
      {
        error: 'Cron job failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
