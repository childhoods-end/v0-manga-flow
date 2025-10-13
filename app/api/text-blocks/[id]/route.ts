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
      .select('*, pages(id, project_id, original_blob_url)')
      .single()

    if (updateError) {
      console.error('Failed to update text block:', updateError)
      return NextResponse.json({ error: 'Failed to update text block' }, { status: 500 })
    }

    // If text or layout changed, re-render the page
    if (updates.translated_text || updates.font_size || updates.bbox) {
      try {
        const page = (updatedBlock as any).pages

        // Get all text blocks for this page
        const { data: allBlocks } = await supabaseAdmin
          .from('text_blocks')
          .select('*')
          .eq('page_id', page.id)
          .eq('status', 'translated')

        if (allBlocks && allBlocks.length > 0) {
          // Fetch original image
          const imageResponse = await fetch(page.original_blob_url)
          const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())

          // Render page with updated text
          const renderedBuffer = await renderPage(
            imageBuffer,
            allBlocks as any,
            { maskOriginalText: true }
          )

          // Upload rendered image
          const renderedBlob = await put(
            `rendered/${page.project_id}/${page.id}.png`,
            renderedBuffer,
            { access: 'public' }
          )

          // Update page with new rendered URL
          await supabaseAdmin
            .from('pages')
            .update({ processed_blob_url: renderedBlob.url })
            .eq('id', page.id)

          console.log(`Re-rendered page ${page.id} after text block update`)
        }
      } catch (renderError) {
        console.error('Failed to re-render page:', renderError)
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
