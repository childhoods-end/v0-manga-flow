import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import sharp from 'sharp'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectId, pages } = body

    if (!projectId || !pages || !Array.isArray(pages)) {
      return NextResponse.json(
        { error: 'projectId and pages array are required' },
        { status: 400 }
      )
    }

    console.log(`Creating ${pages.length} page records for project ${projectId}`)

    // Create page records
    const pageRecords = []

    for (const page of pages) {
      try {
        // Fetch image to get dimensions
        const imageResponse = await fetch(page.imageUrl)
        if (!imageResponse.ok) {
          console.error(`Failed to fetch image: ${page.imageUrl}`)
          continue
        }

        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())
        const metadata = await sharp(imageBuffer).metadata()

        const width = metadata.width || 800
        const height = metadata.height || 1200

        pageRecords.push({
          project_id: projectId,
          page_index: page.pageIndex,
          width,
          height,
          original_blob_url: page.imageUrl,
        })
      } catch (error) {
        console.error(`Failed to process page ${page.pageIndex}:`, error)
        // Still create the page record without dimensions
        pageRecords.push({
          project_id: projectId,
          page_index: page.pageIndex,
          width: 800,
          height: 1200,
          original_blob_url: page.imageUrl,
        })
      }
    }

    // Insert all page records
    const { error: insertError } = await supabaseAdmin
      .from('pages')
      .insert(pageRecords)

    if (insertError) {
      console.error('Failed to insert pages:', insertError)
      return NextResponse.json(
        { error: 'Failed to create page records: ' + insertError.message },
        { status: 500 }
      )
    }

    console.log(`Successfully created ${pageRecords.length} page records`)

    return NextResponse.json({
      success: true,
      pageCount: pageRecords.length,
    })
  } catch (error) {
    console.error('Create pages failed:', error)
    return NextResponse.json(
      {
        error: 'Create pages failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
