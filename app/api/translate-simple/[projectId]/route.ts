import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { translateBlocks, TranslationBlock } from '@/lib/translate'

export const runtime = 'nodejs'
export const maxDuration = 60

interface RouteContext {
  params: Promise<{
    projectId: string
  }>
}

/**
 * Simplified translation API for serverless environments
 * Uses mock OCR data to avoid Tesseract timeout issues
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const { projectId } = await context.params

  try {
    console.log('Starting simplified translation for project:', projectId)

    // Get project details
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // Get all pages
    const { data: pages, error: pagesError } = await supabaseAdmin
      .from('pages')
      .select('*')
      .eq('project_id', projectId)
      .order('page_index')

    if (pagesError || !pages || pages.length === 0) {
      return NextResponse.json(
        { error: 'No pages found' },
        { status: 404 }
      )
    }

    console.log(`Found ${pages.length} pages`)

    // Update status
    await supabaseAdmin
      .from('projects')
      .update({ status: 'processing' })
      .eq('id', projectId)

    const results = []

    for (const page of pages) {
      try {
        console.log(`Processing page ${page.page_index + 1}/${pages.length}`)

        // Get image metadata for positioning
        let imageUrl = page.original_blob_url
        if (!imageUrl.startsWith('http')) {
          imageUrl = `${process.env.NEXT_PUBLIC_APP_URL}${imageUrl}`
        }

        // Mock OCR results for demonstration
        // In production, you would use Google Cloud Vision or other OCR service
        const mockOCRResults = [
          {
            text: '안녕하세요',
            bbox: { x: 50, y: 50, width: 200, height: 40 },
            confidence: 0.95
          }
        ]

        console.log(`Created ${mockOCRResults.length} mock OCR blocks`)

        // Translate text blocks
        const translationBlocks: TranslationBlock[] = mockOCRResults.map((ocr, index) => ({
          id: `${page.id}-${index}`,
          text: ocr.text,
        }))

        console.log('Translating blocks...')
        const translations = await translateBlocks(
          translationBlocks,
          project.source_language,
          project.target_language,
          'openai'
        )

        console.log('Translation complete, saving to database...')

        // Save to database
        const textBlocksToInsert = mockOCRResults.map((ocr, index) => ({
          page_id: page.id,
          bbox: ocr.bbox,
          ocr_text: ocr.text,
          translated_text: translations[index]?.translatedText || ocr.text,
          confidence: ocr.confidence,
          status: 'translated',
        }))

        const { error: insertError } = await supabaseAdmin
          .from('text_blocks')
          .insert(textBlocksToInsert)

        if (insertError) {
          console.error('Failed to save text blocks:', insertError)
          throw insertError
        }

        results.push({
          pageId: page.id,
          pageIndex: page.page_index,
          status: 'success',
          textBlocks: mockOCRResults.length,
        })

        console.log(`Page ${page.page_index} completed`)
      } catch (pageError) {
        console.error(`Failed to process page ${page.page_index}:`, pageError)
        results.push({
          pageId: page.id,
          pageIndex: page.page_index,
          status: 'failed',
          error: pageError instanceof Error ? pageError.message : 'Unknown error',
        })
      }
    }

    // Update final status
    const successCount = results.filter(r => r.status === 'success').length
    const finalStatus = successCount === pages.length ? 'ready' : 'failed'

    await supabaseAdmin
      .from('projects')
      .update({
        status: finalStatus,
        processed_pages: successCount,
      })
      .eq('id', projectId)

    console.log('Translation completed:', { successCount, total: pages.length })

    return NextResponse.json({
      success: true,
      projectId,
      totalPages: pages.length,
      processedPages: successCount,
      results,
      note: 'Using mock OCR data for demonstration. For production, integrate Google Cloud Vision or similar OCR service.'
    })
  } catch (error) {
    console.error('Translation failed:', error)

    await supabaseAdmin
      .from('projects')
      .update({ status: 'failed' })
      .eq('id', projectId)

    return NextResponse.json(
      {
        error: 'Translation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
