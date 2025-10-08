import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { translateBlocks, TranslationBlock } from '@/lib/translate'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Background worker that processes translation jobs
 * Processes one page at a time to avoid timeout
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { jobId } = body

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 })
    }

    console.log('Worker processing job:', jobId)

    // Get job
    const { data: job, error: jobError } = await supabaseAdmin
      .from('translation_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Get project
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', job.project_id)
      .single()

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get pages
    const { data: pages } = await supabaseAdmin
      .from('pages')
      .select('*')
      .eq('project_id', job.project_id)
      .order('page_index')

    if (!pages || pages.length === 0) {
      return NextResponse.json({ error: 'No pages found' }, { status: 404 })
    }

    // Update job status
    await supabaseAdmin
      .from('translation_jobs')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
      })
      .eq('id', jobId)

    // Process pages one by one
    let processedPages = 0

    for (const page of pages) {
      try {
        console.log(`Processing page ${page.page_index + 1}/${pages.length}`)

        // Mock OCR results (replace with real OCR in production)
        const mockOCRResults = [
          {
            text: '안녕하세요',
            bbox: { x: 50, y: 50, width: 200, height: 40 },
            confidence: 0.95
          },
          {
            text: '만화',
            bbox: { x: 100, y: 150, width: 150, height: 35 },
            confidence: 0.92
          }
        ]

        // Translate
        const translationBlocks: TranslationBlock[] = mockOCRResults.map((ocr, index) => ({
          id: `${page.id}-${index}`,
          text: ocr.text,
        }))

        const translations = await translateBlocks(
          translationBlocks,
          project.source_language,
          project.target_language,
          'openai'
        )

        // Save to database
        const textBlocksToInsert = mockOCRResults.map((ocr, index) => ({
          page_id: page.id,
          bbox: ocr.bbox,
          ocr_text: ocr.text,
          translated_text: translations[index]?.translatedText || ocr.text,
          confidence: ocr.confidence,
          status: 'translated',
        }))

        await supabaseAdmin
          .from('text_blocks')
          .insert(textBlocksToInsert)

        processedPages++

        // Update progress
        const progress = Math.round((processedPages / pages.length) * 100)
        await supabaseAdmin
          .from('translation_jobs')
          .update({
            current_page: processedPages,
            progress,
          })
          .eq('id', jobId)

        console.log(`Page ${page.page_index} completed. Progress: ${progress}%`)
      } catch (pageError) {
        console.error(`Failed to process page ${page.page_index}:`, pageError)
        // Continue with next page
      }
    }

    // Update final status
    const success = processedPages === pages.length

    await supabaseAdmin
      .from('translation_jobs')
      .update({
        status: success ? 'completed' : 'failed',
        progress: success ? 100 : Math.round((processedPages / pages.length) * 100),
        completed_at: new Date().toISOString(),
        error_message: success ? null : 'Some pages failed to process',
      })
      .eq('id', jobId)

    await supabaseAdmin
      .from('projects')
      .update({
        status: success ? 'ready' : 'failed',
        processed_pages: processedPages,
      })
      .eq('id', job.project_id)

    console.log(`Job ${jobId} completed. Processed ${processedPages}/${pages.length} pages`)

    return NextResponse.json({
      success: true,
      jobId,
      processedPages,
      totalPages: pages.length,
      status: success ? 'completed' : 'failed',
    })
  } catch (error) {
    console.error('Worker error:', error)
    return NextResponse.json(
      {
        error: 'Worker failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
