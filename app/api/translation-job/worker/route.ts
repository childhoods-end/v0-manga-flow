import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { translateBlocks, TranslationBlock } from '@/lib/translate'
import { performOCR } from '@/lib/ocr'
import { renderPage, renderPageSmart } from '@/lib/render'
import { put } from '@vercel/blob'
import { groupTextBlocksIntoBubbles, findBubbleForTextBlock } from '@/lib/bubbleDetectServer'

export const runtime = 'nodejs'
export const maxDuration = 60 // Max duration on Vercel Pro plan

// Feature toggle: Use smart Canvas-based rendering for better CJK support
const USE_SMART_RENDER = process.env.ENABLE_SMART_RENDER !== 'false'

// Timeout limits for each stage (in milliseconds)
const TIMEOUTS = {
  OCR: 35000,        // 35 seconds
  TRANSLATION: 20000, // 20 seconds
  RENDER: 15000,     // 15 seconds
  UPLOAD: 10000,     // 10 seconds
}

const MAX_RETRIES = 2

/**
 * Helper to run a promise with timeout
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`${errorMessage} (timeout after ${timeoutMs}ms)`)), timeoutMs)
  )
  return Promise.race([promise, timeoutPromise])
}

/**
 * Helper to retry an operation with exponential backoff
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = MAX_RETRIES
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`${operationName}: Attempt ${attempt}/${maxRetries}`)
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error')
      console.error(`${operationName} attempt ${attempt} failed:`, lastError.message)

      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s, etc.
        const delayMs = Math.pow(2, attempt - 1) * 1000
        console.log(`Retrying in ${delayMs}ms...`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }
  }

  throw lastError || new Error(`${operationName} failed after ${maxRetries} attempts`)
}

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
    const pageStartTime = Date.now()
    console.log(`\n========== Processing page ${currentPage + 1}/${pages.length} (Page ID: ${page.id}) ==========`)

    // Track stage timings for monitoring
    const stageTiming: Record<string, number> = {}

    try {
      // Stage 1: Fetch and optimize image
      const fetchStartTime = Date.now()
      let imageBuffer: Buffer

      if (page.original_blob_url.startsWith('http')) {
        console.log('📥 Fetching image from URL:', page.original_blob_url)
        const response = await withTimeout(
          fetch(page.original_blob_url),
          10000,
          'Image fetch timeout'
        )
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

      stageTiming.fetch = Date.now() - fetchStartTime
      console.log(`✅ Image fetched in ${stageTiming.fetch}ms, size: ${imageBuffer.length} bytes`)

      // Optimize image for faster OCR - resize to max 1200px width (reduced from 1500px)
      const optimizeStartTime = Date.now()
      const sharp = (await import('sharp')).default
      const metadata = await sharp(imageBuffer).metadata()

      if (metadata.width && metadata.width > 1200) {
        console.log(`🔧 Resizing image from ${metadata.width}px to 1200px for faster OCR`)
        imageBuffer = await sharp(imageBuffer)
          .resize(1200, null, { withoutEnlargement: true })
          .jpeg({ quality: 90 }) // Convert to JPEG for smaller size
          .toBuffer()
      }

      stageTiming.optimize = Date.now() - optimizeStartTime
      console.log(`✅ Image optimized in ${stageTiming.optimize}ms, final size: ${imageBuffer.length} bytes`)

      // Stage 2: Perform OCR with timeout and retry
      console.log('\n🔍 Stage 2: OCR Processing')
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

      let ocrResults
      try {
        ocrResults = await withRetry(
          async () => {
            return await withTimeout(
              performOCR(imageBuffer, ocrProvider, {
                language: getOCRLanguageCode(project.source_language),
              }),
              TIMEOUTS.OCR,
              'OCR operation timeout'
            )
          },
          'OCR'
        )

        stageTiming.ocr = Date.now() - ocrStartTime
        console.log(`✅ OCR completed in ${stageTiming.ocr}ms, found ${ocrResults.length} text blocks`)
      } catch (ocrError) {
        console.error('❌ OCR failed after retries:', ocrError)

        // Save OCR error and skip to next page
        await supabaseAdmin
          .from('pages')
          .update({
            metadata: {
              ocr_error: ocrError instanceof Error ? ocrError.message : 'Unknown OCR error',
              ocr_error_time: new Date().toISOString(),
              stage_timing: stageTiming
            }
          })
          .eq('id', page.id)

        // Mark page as processed but failed, continue to next page
        throw new Error(`OCR failed: ${ocrError instanceof Error ? ocrError.message : 'Unknown error'}`)
      }

      if (ocrResults.length > 0) {
        // Stage 3: Translate text blocks with timeout and retry
        console.log('\n🌐 Stage 3: Translation Processing')
        const translationBlocks: TranslationBlock[] = ocrResults.map((ocr, index) => ({
          id: `${page.id}-${index}`,
          text: ocr.text,
        }))

        // Use Google Translate if Vision API is available, otherwise OpenAI
        const translationProvider = process.env.GOOGLE_CLOUD_VISION_KEY ? 'google' : 'openai'
        console.log(`Using translation provider: ${translationProvider}`)
        const translateStartTime = Date.now()

        let translations
        try {
          translations = await withRetry(
            async () => {
              return await withTimeout(
                translateBlocks(
                  translationBlocks,
                  project.source_language,
                  project.target_language,
                  translationProvider
                ),
                TIMEOUTS.TRANSLATION,
                'Translation operation timeout'
              )
            },
            'Translation'
          )

          stageTiming.translation = Date.now() - translateStartTime
          console.log(`✅ Translation completed in ${stageTiming.translation}ms`)
        } catch (translationError) {
          console.error('❌ Translation failed after retries:', translationError)

          // Fallback: Use original text if translation fails
          console.log('⚠️  Using original text as fallback')
          translations = translationBlocks.map(block => ({
            id: block.id,
            originalText: block.text,
            translatedText: block.text,
            provider: translationProvider
          }))
          stageTiming.translation = Date.now() - translateStartTime
        }

        // Stage 3.5: Detect speech bubbles and save to database
        console.log('\n💬 Stage 3.5: Detecting speech bubbles')
        const bubbleDetectStartTime = Date.now()

        // Group text blocks into bubbles based on proximity
        const textBlocksWithIds = ocrResults.map((ocr, index) => ({
          id: `temp-${index}`,
          bbox: ocr.bbox
        }))
        const detectedBubbles = groupTextBlocksIntoBubbles(textBlocksWithIds)

        stageTiming.bubbleDetect = Date.now() - bubbleDetectStartTime
        console.log(`✅ Detected ${detectedBubbles.length} speech bubbles in ${stageTiming.bubbleDetect}ms`)

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

        // Stage 4: Save bubbles and text blocks to database
        console.log('\n💾 Stage 4: Saving to database')
        const saveStartTime = Date.now()

        // Check if data already exists for this page
        const { data: existingBlocks } = await supabaseAdmin
          .from('text_blocks')
          .select('id')
          .eq('page_id', page.id)

        const { data: existingBubbles } = await supabaseAdmin
          .from('speech_bubbles')
          .select('id')
          .eq('page_id', page.id)

        // Only insert if no existing data to avoid duplicates
        if ((!existingBlocks || existingBlocks.length === 0) && (!existingBubbles || existingBubbles.length === 0)) {
          // First, insert speech bubbles
          const bubblesData = detectedBubbles.map(bubble => ({
            page_id: page.id,
            bbox: bubble.bbox,
            score: bubble.score
          }))

          const { data: insertedBubbles, error: bubbleError } = await supabaseAdmin
            .from('speech_bubbles')
            .insert(bubblesData)
            .select('id, bbox')

          if (bubbleError) {
            console.error('❌ Failed to insert bubbles:', bubbleError)
          } else {
            console.log(`✅ Saved ${insertedBubbles?.length || 0} speech bubbles`)

            // Then, insert text blocks with bubble_id references
            const textBlocksWithBubbles = textBlocksToInsert.map((textBlock, index) => {
              // Find which bubble this text block belongs to
              const bubble = findBubbleForTextBlock(
                textBlock.bbox as any,
                insertedBubbles?.map((b, i) => ({
                  id: b.id,
                  bbox: b.bbox as any,
                  score: detectedBubbles[i]?.score || 0,
                  textBlockIds: []
                })) || []
              )

              return {
                ...textBlock,
                bubble_id: insertedBubbles?.find(b =>
                  JSON.stringify(b.bbox) === JSON.stringify(bubble?.bbox)
                )?.id || null
              }
            })

            await supabaseAdmin
              .from('text_blocks')
              .insert(textBlocksWithBubbles)

            stageTiming.save = Date.now() - saveStartTime
            console.log(`✅ Saved ${textBlocksWithBubbles.length} text blocks in ${stageTiming.save}ms`)
          }
        } else {
          stageTiming.save = Date.now() - saveStartTime
          console.log(`⏭️  Skipped insert - data already exists for page ${page.id}`)
        }

        // Stage 5: Render the translated page with timeout and retry
        console.log('\n🎨 Stage 5: Rendering page')
        const renderStartTime = Date.now()

        try {
          // Use smart rendering if enabled for better CJK font support and text layout
          const renderFunction = USE_SMART_RENDER ? renderPageSmart : renderPage
          console.log(`Using ${USE_SMART_RENDER ? 'smart Canvas' : 'SVG'} rendering`)

          const renderedBuffer = await withRetry(
            async () => {
              return await withTimeout(
                USE_SMART_RENDER
                  ? renderPageSmart(
                      imageBuffer,
                      textBlocksToInsert as any,
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
                  : renderPage(
                      imageBuffer,
                      textBlocksToInsert as any,
                      { maskOriginalText: true }
                    ),
                TIMEOUTS.RENDER,
                'Render operation timeout'
              )
            },
            'Render',
            1 // Only 1 retry for render to save time
          )

          stageTiming.render = Date.now() - renderStartTime
          console.log(`✅ Render completed in ${stageTiming.render}ms, output size: ${renderedBuffer.length} bytes`)

          // Stage 6: Upload rendered image to Vercel Blob with timeout and retry
          console.log('\n📤 Stage 6: Uploading to Vercel Blob')
          const uploadStartTime = Date.now()

          try {
            const renderedBlob = await withRetry(
              async () => {
                return await withTimeout(
                  put(
                    `rendered/${project.id}/${page.id}.png`,
                    renderedBuffer,
                    { access: 'public' }
                  ),
                  TIMEOUTS.UPLOAD,
                  'Upload operation timeout'
                )
              },
              'Upload',
              1 // Only 1 retry for upload
            )

            stageTiming.upload = Date.now() - uploadStartTime
            console.log(`✅ Upload completed in ${stageTiming.upload}ms: ${renderedBlob.url}`)

            // Update page with rendered URL and timing data
            const { error: updateError } = await supabaseAdmin
              .from('pages')
              .update({
                processed_blob_url: renderedBlob.url,
                metadata: {
                  stage_timing: stageTiming,
                  processed_at: new Date().toISOString()
                }
              })
              .eq('id', page.id)

            if (updateError) {
              console.error(`❌ Failed to update page in database:`, updateError)
            } else {
              console.log(`✅ Page ${page.id} fully processed and saved`)
            }
          } catch (uploadError: any) {
            console.error(`❌ Upload failed after retries:`, uploadError.message)

            // Save upload error but don't fail the page
            await supabaseAdmin
              .from('pages')
              .update({
                metadata: {
                  upload_error: uploadError.message,
                  upload_error_time: new Date().toISOString(),
                  stage_timing: stageTiming
                }
              })
              .eq('id', page.id)

            console.log('⚠️  Page processed but upload failed - continuing to next page')
          }
        } catch (renderError: any) {
          console.error(`❌ Render failed after retries:`, renderError.message)

          // Save render error but don't fail the page
          await supabaseAdmin
            .from('pages')
            .update({
              metadata: {
                render_error: renderError.message,
                render_error_time: new Date().toISOString(),
                stage_timing: stageTiming
              }
            })
            .eq('id', page.id)

          console.log('⚠️  Page processed but render failed - continuing to next page')
        }
      } else {
        console.log('⚠️  No text found on this page')
      }

      // Calculate total page processing time
      const totalPageTime = Date.now() - pageStartTime
      stageTiming.total = totalPageTime

      // Log performance summary
      console.log('\n📊 Performance Summary:')
      console.log(`   Total time: ${totalPageTime}ms (${(totalPageTime / 1000).toFixed(1)}s)`)
      console.log(`   Fetch: ${stageTiming.fetch || 0}ms`)
      console.log(`   Optimize: ${stageTiming.optimize || 0}ms`)
      console.log(`   OCR: ${stageTiming.ocr || 0}ms`)
      console.log(`   Translation: ${stageTiming.translation || 0}ms`)
      console.log(`   Save: ${stageTiming.save || 0}ms`)
      console.log(`   Render: ${stageTiming.render || 0}ms`)
      console.log(`   Upload: ${stageTiming.upload || 0}ms`)

      // Warning if processing took too long
      if (totalPageTime > 45000) {
        console.warn(`⚠️  WARNING: Page processing took ${(totalPageTime / 1000).toFixed(1)}s - approaching timeout limit`)
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

      console.log(`\n✅ Page ${currentPage + 1}/${pages.length} completed. Progress: ${progress}%`)
      console.log(`========================================\n`)

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
      console.error(`\n❌ Failed to process page ${currentPage + 1}:`, pageError)

      // Save error details to page metadata
      await supabaseAdmin
        .from('pages')
        .update({
          metadata: {
            page_error: pageError instanceof Error ? pageError.message : 'Unknown error',
            page_error_time: new Date().toISOString(),
            page_error_stack: pageError instanceof Error ? pageError.stack : undefined,
            stage_timing: stageTiming
          }
        })
        .eq('id', page.id)

      // Don't fail the entire job - skip to next page instead
      console.log('⚠️  Skipping failed page and continuing to next page...')

      const newCurrentPage = currentPage + 1
      const progress = Math.round((newCurrentPage / pages.length) * 100)

      await supabaseAdmin
        .from('translation_jobs')
        .update({
          current_page: newCurrentPage,
          progress,
        })
        .eq('id', jobId)

      // If this was the last page, complete the job
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

        return NextResponse.json({
          success: true,
          message: 'Job completed with some failed pages',
          jobId,
          processedPage: currentPage,
          totalPages: pages.length,
          progress: 100,
          hasMore: false,
          pageError: pageError instanceof Error ? pageError.message : 'Unknown error'
        })
      }

      return NextResponse.json({
        success: true,
        jobId,
        processedPage: currentPage,
        totalPages: pages.length,
        progress,
        hasMore: newCurrentPage < pages.length,
        pageError: pageError instanceof Error ? pageError.message : 'Unknown error'
      })
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
