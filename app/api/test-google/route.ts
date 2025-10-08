import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 10

export async function GET() {
  try {
    // Test if Google Cloud packages can be imported
    const vision = await import('@google-cloud/vision')
    const translate = await import('@google-cloud/translate')

    const hasCredentials = !!process.env.GOOGLE_CLOUD_VISION_KEY

    let credentialsParsed = false
    if (hasCredentials) {
      try {
        const creds = JSON.parse(process.env.GOOGLE_CLOUD_VISION_KEY!)
        credentialsParsed = !!(creds.project_id && creds.client_email && creds.private_key)
      } catch (e) {
        // Invalid JSON
      }
    }

    return NextResponse.json({
      success: true,
      visionLoaded: !!vision,
      translateLoaded: !!translate,
      hasCredentials,
      credentialsParsed,
      projectId: credentialsParsed ? JSON.parse(process.env.GOOGLE_CLOUD_VISION_KEY!).project_id : null,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}
