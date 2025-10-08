import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 10

interface RouteContext {
  params: Promise<{
    jobId: string
  }>
}

/**
 * Manually trigger worker for a specific job
 * Useful for debugging or retrying failed jobs
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { jobId } = await context.params

    console.log('Manually triggering worker for job:', jobId)

    const workerUrl = new URL('/api/translation-job/worker', request.url).toString()

    const response = await fetch(workerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId }),
    })

    const result = await response.json()

    return NextResponse.json({
      success: response.ok,
      jobId,
      workerResult: result,
    })
  } catch (error) {
    console.error('Failed to trigger worker:', error)
    return NextResponse.json(
      {
        error: 'Failed to trigger worker',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
