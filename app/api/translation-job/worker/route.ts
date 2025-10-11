import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { translateBlocks, TranslationBlock } from '@/lib/translate'
import { performOCR } from '@/lib/ocr'

export const runtime = 'nodejs'
export const maxDuration = 60 // Max duration on Vercel Pro plan

/**
 * Background worker that processes translation jobs
 * Processes ONE page per invocation to avoid timeout
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

    // Check if already completed
    if (job.status === 'completed') {
      return NextResponse.json({ message: 'Job already completed', jobId })
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

    // Update job status to processing if pending
    if (job.status === 'pending') {
      await supabaseAdmin
        .from('translation_jobs')
        .update({
          status: 'processing',
          started_at: new Date().toISOString(),
        })
        .eq('id', jobId)
    }

    // Find next unprocessed page
    const currentPage = job.current_page || 0

    if (currentPage >= pages.length) {
      // All pages processed, mark as completed
      await supabaseAdmin
        .from('translation_jobs')
        .update({
          status: 'completed',
          progress: 100,
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId)

      await supabaseAdmin
        .from('projects')
        .update({
          status: 'ready',
          processed_pages: pages.length,
        })
        .eq('id', job.project_id)

      console.log(`Job ${jobId} completed. All ${pages.length} pages processed`)
      return NextResponse.json({ success: true, message: 'Job completed', jobId })
    }

    const page = pages[currentPage]
    console.log(`Processing page ${currentPage + 1}/${pages.length}`)

    try {
      // Get image buffer
      let imageBuffer: Buffer

      if (page.original_blob_url.startsWith('http')) {
        console.log('Fetching image from URL:', page.original_blob_url)
        const response = await fetch(page.original_blob_url)
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.statusText}`)
        }
        imageBuffer = Buffer.from(await response.arrayBuffer())
      } else {
        const { readFile } = await import('fs/promises')
        const { join } = await import('path')
        const imagePath = join(process.cwd(), 'public', page.original_blob_url)
        imageBuffer = await readFile(imagePath)
      }

      // Optimize image for faster OCR - resize to max 1500px width
      const sharp = (await import('sharp')).default
      const metadata = await sharp(imageBuffer).metadata()

      if (metadata.width && metadata.width > 1500) {
        console.log(`Resizing image from ${metadata.width}px to 1500px for faster OCR`)
        imageBuffer = await sharp(imageBuffer)
          .resize(1500, null, { withoutEnlargement: true })
          .toBuffer()
      }

      console.log('Performing OCR...')
      const ocrStartTime = Date.now()

      // Determine OCR language
      function getOCRLanguageCode(lang: string): string {
        const mapping: Record<string, string> = {
          ja: 'jpn+eng',
          en: 'eng',
          zh: 'chi_sim+eng',
          ko: 'kor+eng',
          es: 'spa+eng',
          fr: 'fra+eng',
          de: 'deu+eng',
        }
        return mapping[lang] || 'eng'
      }

      // Use Google Cloud Vision if available, otherwise fall back to Tesseract
      const ocrProvider = process.env.GOOGLE_CLOUD_VISION_KEY ? 'google' : 'tesseract'
      console.log(`Using OCR provider: ${ocrProvider}`)

      const ocrResults = await performOCR(imageBuffer, ocrProvider, {
        language: getOCRLanguageCode(project.source_language),
      })

      const ocrElapsed = Math.round((Date.now() - ocrStartTime) / 1000)
      console.log(`OCR found ${ocrResults.length} text blocks in ${ocrElapsed}s`)

      if (ocrResults.length > 0) {
        // Translate text blocks
        const translationBlocks: TranslationBlock[] = ocrResults.map((ocr, index) => ({
          id: `${page.id}-${index}`,
          text: ocr.text,
        }))

        // Use Google Translate if Vision API is available, otherwise OpenAI
        const translationProvider = process.env.GOOGLE_CLOUD_VISION_KEY ? 'google' : 'openai'
        console.log(`Translating with ${translationProvider}...`)
        const translateStartTime = Date.now()

        const translations = await translateBlocks(
          translationBlocks,
          project.source_language,
          project.target_language,
          translationProvider
        )

        const translateElapsed = Math.round((Date.now() - translateStartTime) / 1000)
        console.log(`Translation completed in ${translateElapsed}s`)

        // Save to database with estimated font size and orientation
        const textBlocksToInsert = ocrResults.map((ocr, index) => {
          // Estimate original font size from bbox height
          const estimatedFontSize = ocr.orientation === 'vertical'
            ? Math.round(ocr.bbox.width * 0.8) // Vertical text: use width
            : Math.round(ocr.bbox.height * 0.65) // Horizontal text: use height

          return {
            page_id: page.id,
            bbox: ocr.bbox,
            ocr_text: ocr.text,
            translated_text: translations[index]?.translatedText || ocr.text,
            confidence: ocr.confidence,
            status: 'translated',
            font_size: estimatedFontSize,
            text_orientation: ocr.orientation || 'horizontal',
          }
        })

        await supabaseAdmin
          .from('text_blocks')
          .insert(textBlocksToInsert)

        console.log(`Saved ${textBlocksToInsert.length} text blocks to database`)
      } else {
        console.log('No text found on this page')
      }

      // Update progress
      const newCurrentPage = currentPage + 1
      const progress = Math.round((newCurrentPage / pages.length) * 100)

      await supabaseAdmin
        .from('translation_jobs')
        .update({
          current_page: newCurrentPage,
          progress,
        })
        .eq('id', jobId)

      console.log(`Page ${currentPage} completed. Progress: ${progress}%`)

      // Check if this was the last page
      if (newCurrentPage >= pages.length) {
        await supabaseAdmin
          .from('translation_jobs')
          .update({
            status: 'completed',
            progress: 100,
            completed_at: new Date().toISOString(),
          })
          .eq('id', jobId)

        await supabaseAdmin
          .from('projects')
          .update({
            status: 'ready',
            processed_pages: pages.length,
          })
          .eq('id', job.project_id)

        console.log(`Job ${jobId} completed`)
      }

      return NextResponse.json({
        success: true,
        jobId,
        processedPage: currentPage,
        totalPages: pages.length,
        progress,
        hasMore: newCurrentPage < pages.length,
      })
    } catch (pageError) {
      console.error(`Failed to process page ${currentPage}:`, pageError)

      // Mark job as failed
      await supabaseAdmin
        .from('translation_jobs')
        .update({
          status: 'failed',
          error_message: pageError instanceof Error ? pageError.message : 'Unknown error',
        })
        .eq('id', jobId)

      await supabaseAdmin
        .from('projects')
        .update({ status: 'failed' })
        .eq('id', job.project_id)

      throw pageError
    }
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
