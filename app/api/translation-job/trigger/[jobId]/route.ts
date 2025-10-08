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

    console.log('Worker response status:', response.status)

    // Get response text first to handle errors
    const responseText = await response.text()
    console.log('Worker response preview:', responseText.substring(0, 300))

    // Try to parse as JSON
    let result
    try {
      result = JSON.parse(responseText)
    } catch (parseError) {
      console.error('Failed to parse worker response as JSON')
      return NextResponse.json({
        success: false,
        jobId,
        error: 'Worker returned invalid response',
        statusCode: response.status,
        responsePreview: responseText.substring(0, 200),
      })
    }

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
