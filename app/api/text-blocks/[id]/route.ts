import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { renderPageSmart } from '@/lib/render'
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
    const allowedFields = ['translated_text', 'font_size', 'bbox', 'status', 'is_vertical']
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

          // Render page with updated text using smart Canvas rendering for CJK support
          console.log('Starting smart render...')
          const renderedBuffer = await renderPageSmart(
            imageBuffer,
            allBlocks as any,
            {
              maskOriginalText: true,
              maxFont: 36,
              minFont: 10,
              lineHeight: 1.45,
              padding: 12,
              textAlign: 'center',
              verticalAlign: 'middle',
              maxLines: 3,
              overflowStrategy: 'ellipsis',
              shadowBlur: 2,
              lang: 'auto'
            }
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

/**
 * Delete a text block completely
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const blockId = params.id

    // Get the text block first to retrieve page_id
    const { data: block, error: getError } = await supabaseAdmin
      .from('text_blocks')
      .select('page_id')
      .eq('id', blockId)
      .single()

    if (getError || !block) {
      return NextResponse.json({ error: 'Text block not found' }, { status: 404 })
    }

    // Delete the text block
    const { error: deleteError } = await supabaseAdmin
      .from('text_blocks')
      .delete()
      .eq('id', blockId)

    if (deleteError) {
      console.error('Failed to delete text block:', deleteError)
      return NextResponse.json({ error: 'Failed to delete text block' }, { status: 500 })
    }

    console.log('Text block deleted:', blockId)

    // Re-render the page with remaining text blocks
    try {
      const pageId = (block as any).page_id

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

      console.log('Re-rendering page after deletion:', page)

      // Get all remaining text blocks for this page
      const { data: allBlocks } = await supabaseAdmin
        .from('text_blocks')
        .select('*')
        .eq('page_id', pageId)

      console.log(`Found ${allBlocks?.length || 0} remaining text blocks for re-render`)

      // Fetch original image
      const imageResponse = await fetch((page as any).original_blob_url)
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.statusText}`)
      }
      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())

      // Render page with remaining text blocks using smart Canvas rendering for CJK support
      const renderedBuffer = await renderPageSmart(
        imageBuffer,
        allBlocks || [],
        {
          maskOriginalText: true,
          maxFont: 36,
          minFont: 10,
          lineHeight: 1.45,
          padding: 12,
          textAlign: 'center',
          verticalAlign: 'middle',
          maxLines: 3,
          overflowStrategy: 'ellipsis',
          shadowBlur: 2,
          lang: 'auto'
        }
      )

      // Upload rendered image
      const renderedBlob = await put(
        `rendered/${(page as any).project_id}/${pageId}.png`,
        renderedBuffer,
        { access: 'public' }
      )

      // Update page with new rendered URL
      await supabaseAdmin
        .from('pages')
        .update({ processed_blob_url: renderedBlob.url })
        .eq('id', pageId)

      console.log(`✅ Re-rendered page ${pageId} after text block deletion`)
    } catch (renderError: any) {
      console.error('❌ Failed to re-render page:', renderError)
      // Don't fail the request if rendering fails
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Text block deletion failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
