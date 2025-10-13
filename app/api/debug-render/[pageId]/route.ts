import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { renderPage } from '@/lib/render'
import { put } from '@vercel/blob'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Debug endpoint to manually trigger rendering for a specific page
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { pageId: string } }
) {
  try {
    const pageId = params.pageId

    console.log(`[DEBUG] Starting manual render for page ${pageId}`)

    // Get page and text blocks
    const { data: page, error: pageError } = await supabaseAdmin
      .from('pages')
      .select('*')
      .eq('id', pageId)
      .single()

    if (pageError || !page) {
      console.error('[DEBUG] Page not found:', pageError)
      return NextResponse.json({ error: 'Page not found' }, { status: 404 })
    }

    console.log('[DEBUG] Page found:', {
      id: page.id,
      project_id: (page as any).project_id,
      has_original: !!(page as any).original_blob_url,
      has_processed: !!(page as any).processed_blob_url,
    })

    const { data: textBlocks, error: blocksError } = await supabaseAdmin
      .from('text_blocks')
      .select('*')
      .eq('page_id', pageId)

    if (blocksError) {
      console.error('[DEBUG] Failed to get text blocks:', blocksError)
      return NextResponse.json({ error: 'Failed to get text blocks' }, { status: 500 })
    }

    console.log(`[DEBUG] Found ${textBlocks?.length || 0} text blocks`)

    if (!textBlocks || textBlocks.length === 0) {
      return NextResponse.json({ error: 'No text blocks found for this page' }, { status: 400 })
    }

    const translatedBlocks = textBlocks.filter((b: any) => b.translated_text)
    console.log(`[DEBUG] ${translatedBlocks.length} blocks have translations`)

    if (translatedBlocks.length === 0) {
      return NextResponse.json({ error: 'No translated text blocks found' }, { status: 400 })
    }

    // Fetch original image
    console.log('[DEBUG] Fetching original image...')
    const imageResponse = await fetch((page as any).original_blob_url)
    if (!imageResponse.ok) {
      console.error('[DEBUG] Failed to fetch image:', imageResponse.status)
      return NextResponse.json({ error: 'Failed to fetch image' }, { status: 500 })
    }
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())
    console.log(`[DEBUG] Image fetched, size: ${imageBuffer.length} bytes`)

    // Render page
    console.log('[DEBUG] Starting render...')
    const renderedBuffer = await renderPage(
      imageBuffer,
      translatedBlocks as any,
      { maskOriginalText: true }
    )
    console.log(`[DEBUG] Render completed, size: ${renderedBuffer.length} bytes`)

    // Upload rendered image
    console.log('[DEBUG] Uploading to Vercel Blob...')
    const renderedBlob = await put(
      `rendered/${(page as any).project_id}/${pageId}.png`,
      renderedBuffer,
      { access: 'public' }
    )
    console.log('[DEBUG] Upload completed:', renderedBlob.url)

    // Update page
    const { error: updateError } = await supabaseAdmin
      .from('pages')
      .update({ processed_blob_url: renderedBlob.url })
      .eq('id', pageId)

    if (updateError) {
      console.error('[DEBUG] Failed to update page:', updateError)
      return NextResponse.json({ error: 'Failed to update page' }, { status: 500 })
    }

    console.log('[DEBUG] Page updated successfully')

    return NextResponse.json({
      success: true,
      pageId,
      renderedUrl: renderedBlob.url,
      textBlockCount: translatedBlocks.length,
    })
  } catch (error: any) {
    console.error('[DEBUG] Render failed:', error)
    return NextResponse.json({
      error: 'Render failed',
      message: error.message,
      stack: error.stack,
    }, { status: 500 })
  }
}
