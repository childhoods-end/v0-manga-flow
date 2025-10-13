import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { renderPage } from '@/lib/render'
import { put } from '@vercel/blob'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Update a text block
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const blockId = params.id
    const updates = await request.json()

    // Validate updates
    const allowedFields = ['translated_text', 'font_size', 'bbox', 'status']
    const filteredUpdates = Object.keys(updates)
      .filter(key => allowedFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = updates[key]
        return obj
      }, {} as any)

    if (Object.keys(filteredUpdates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    // Update text block
    const { data: updatedBlock, error: updateError } = await supabaseAdmin
      .from('text_blocks')
      .update(filteredUpdates)
      .eq('id', blockId)
      .select('*')
      .single()

    if (updateError) {
      console.error('Failed to update text block:', updateError)
      return NextResponse.json({ error: 'Failed to update text block', details: updateError }, { status: 500 })
    }

    console.log('Text block updated:', updatedBlock)

    // If text or layout changed, re-render the page
    if (updates.translated_text !== undefined || updates.font_size !== undefined || updates.bbox !== undefined) {
      try {
        const pageId = (updatedBlock as any).page_id

        // Get page info
        const { data: page, error: pageError } = await supabaseAdmin
          .from('pages')
          .select('*')
          .eq('id', pageId)
          .single()

        if (pageError || !page) {
          console.error('Failed to get page:', pageError)
          throw new Error('Page not found')
        }

        console.log('Re-rendering page:', page)

        // Get all text blocks for this page
        const { data: allBlocks } = await supabaseAdmin
          .from('text_blocks')
          .select('*')
          .eq('page_id', pageId)

        console.log(`Found ${allBlocks?.length || 0} text blocks for re-render`)

        if (allBlocks && allBlocks.length > 0) {
          // Fetch original image
          console.log('Fetching original image from:', (page as any).original_blob_url)
          const imageResponse = await fetch((page as any).original_blob_url)
          if (!imageResponse.ok) {
            throw new Error(`Failed to fetch image: ${imageResponse.statusText}`)
          }
          const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())
          console.log('Image fetched, size:', imageBuffer.length)

          // Render page with updated text
          console.log('Starting render...')
          const renderedBuffer = await renderPage(
            imageBuffer,
            allBlocks as any,
            { maskOriginalText: true }
          )
          console.log('Render complete, size:', renderedBuffer.length)

          // Upload rendered image
          console.log('Uploading to Vercel Blob...')
          const renderedBlob = await put(
            `rendered/${(page as any).project_id}/${pageId}.png`,
            renderedBuffer,
            { access: 'public' }
          )
          console.log('Upload complete:', renderedBlob.url)

          // Update page with new rendered URL
          await supabaseAdmin
            .from('pages')
            .update({ processed_blob_url: renderedBlob.url })
            .eq('id', pageId)

          console.log(`✅ Re-rendered page ${pageId} after text block update`)
        }
      } catch (renderError: any) {
        console.error('❌ Failed to re-render page:', renderError)
        console.error('Error stack:', renderError.stack)
        // Don't fail the request if rendering fails
      }
    }

    return NextResponse.json({ success: true, block: updatedBlock })
  } catch (error) {
    console.error('Text block update failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Get a text block
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const blockId = params.id

    const { data: block, error } = await supabaseAdmin
      .from('text_blocks')
      .select('*')
      .eq('id', blockId)
      .single()

    if (error || !block) {
      return NextResponse.json({ error: 'Text block not found' }, { status: 404 })
    }

    return NextResponse.json(block)
  } catch (error) {
    console.error('Failed to get text block:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
