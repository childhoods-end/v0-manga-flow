/**
 * Task Queue System for MangaFlow
 *
 * This is a simplified queue implementation for Vercel.
 * For production, consider using Vercel Queue or Upstash Redis Queue.
 */

import { supabaseAdmin } from '@/lib/supabase/server'
import { performOCR } from '@/lib/ocr'
import { translateBlocks } from '@/lib/translate'
import { renderPage, generateThumbnail } from '@/lib/render'
import { moderationGateway } from '@/lib/moderation'
import { put } from '@vercel/blob'
import logger from '@/lib/logger'
import { retry } from '@/lib/utils'
import type { TranslationProvider } from '@/lib/constants'

export type JobType = 'ocr' | 'translate' | 'render' | 'export'

export interface QueueJob {
  id: string
  projectId: string
  type: JobType
  metadata: any
}

/**
 * Process OCR job for a page
 */
export async function processOcrJob(pageId: string, projectId: string) {
  logger.info({ pageId, projectId }, 'Starting OCR job')

  try {
    // Get page data
    const { data: page, error: pageError } = await supabaseAdmin
      .from('pages')
      .select('*')
      .eq('id', pageId)
      .single()

    if (pageError || !page) {
      throw new Error(`Page not found: ${pageId}`)
    }

    // Fetch original image
    const imageResponse = await fetch((page as any).original_blob_url)
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.statusText}`)
    }
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())

    // Get project language
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('source_language')
      .eq('id', projectId)
      .single()

    // Perform OCR
    const ocrResults = await retry(
      () => performOCR(imageBuffer, 'tesseract', {
        language: (project as any)?.source_language === 'ja' ? 'jpn+eng' : 'eng',
      }),
      { maxAttempts: 3 }
    )

    // Insert text blocks
    for (const result of ocrResults) {
      const { error: insertError } = await supabaseAdmin
        .from('text_blocks')
        // @ts-expect-error - Supabase type inference issue
        .insert({
          page_id: pageId,
          bbox: result.bbox,
          ocr_text: result.text,
          confidence: result.confidence,
          status: 'ocr_done',
        })

      if (insertError) {
        logger.error({ error: insertError }, 'Failed to insert text block')
      }

      // Flag low confidence blocks for review
      if (result.confidence < 0.7) {
        const { data: block } = await supabaseAdmin
          .from('text_blocks')
          .select('id')
          .eq('page_id', pageId)
          .eq('ocr_text', result.text)
          .single()

        if (block) {
          await supabaseAdmin
            .from('review_items')
            // @ts-expect-error - Supabase type inference issue
            .insert({
              text_block_id: (block as any).id,
              reason: 'low_conf',
            })
        }
      }
    }

    // Generate thumbnail
    const thumbnailBuffer = await generateThumbnail(imageBuffer, 300)
    // @ts-expect-error - Vercel Blob type compatibility
    const thumbnailBlob = await put(`thumbnails/${projectId}/${pageId}.jpg`, thumbnailBuffer, {
      access: 'public',
    })

    // Update page with thumbnail
    await supabaseAdmin
      .from('pages')
      // @ts-expect-error - Supabase type inference issue
      .update({ thumbnail_blob_url: thumbnailBlob.url })
      .eq('id', pageId)

    logger.info({ pageId, blockCount: ocrResults.length }, 'OCR job completed')
  } catch (error) {
    logger.error({ error, pageId }, 'OCR job failed')
    throw error
  }
}

/**
 * Process translation job for a project
 */
export async function processTranslateJob(projectId: string) {
  logger.info({ projectId }, 'Starting translation job')

  try {
    // Get project config
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      throw new Error(`Project not found: ${projectId}`)
    }

    // Get all text blocks that need translation
    const { data: textBlocks } = await supabaseAdmin
      .from('text_blocks')
      .select('*')
      .eq('page_id', supabaseAdmin.from('pages').select('id').eq('project_id', projectId))
      .eq('status', 'ocr_done')

    if (!textBlocks || textBlocks.length === 0) {
      logger.info({ projectId }, 'No text blocks to translate')
      return
    }

    // Prepare translation blocks
    const blocks = (textBlocks as any[])
      .filter(tb => tb.ocr_text)
      .map(tb => ({
        id: tb.id,
        text: tb.ocr_text!,
      }))

    // Translate in batches
    const batchSize = 20
    for (let i = 0; i < blocks.length; i += batchSize) {
      const batch = blocks.slice(i, i + batchSize)

      const provider = (process.env.DEFAULT_TRANSLATION_PROVIDER || 'claude') as TranslationProvider
      const results = await retry(
        () => translateBlocks(
          batch,
          (project as any).source_language,
          (project as any).target_language,
          provider
        ),
        { maxAttempts: 3 }
      )

      // Moderate and update translations
      for (const result of results) {
        // Run moderation
        const moderationResult = await moderationGateway.moderate({
          originalText: result.originalText,
          translatedText: result.translatedText,
          contentRating: (project as any).content_rating,
        })

        let finalText = result.translatedText
        let status: 'translated' | 'flagged' = 'translated'

        if (moderationResult.action === 'mask') {
          finalText = moderationResult.maskedText || result.translatedText
        } else if (moderationResult.action === 'flag' || moderationResult.action === 'block') {
          status = 'flagged'

          // Create review item
          await supabaseAdmin
            .from('review_items')
            // @ts-expect-error - Supabase type inference issue
            .insert({
              text_block_id: result.id,
              reason: 'policy_flag',
            })
        }

        // Update text block
        await supabaseAdmin
          .from('text_blocks')
          // @ts-expect-error - Supabase type inference issue
          .update({
            translated_text: finalText,
            status,
          })
          .eq('id', result.id)

        // Record billing usage
        await supabaseAdmin
          .from('billing_usage')
          // @ts-expect-error - Supabase type inference issue
          .insert({
            user_id: (project as any).owner_id,
            project_id: projectId,
            tokens: result.tokensUsed,
            pages: 0,
            amount_cents: Math.ceil(result.tokensUsed * 0.001), // $0.001 per token
            description: 'Translation',
          })
      }
    }

    logger.info({ projectId, blockCount: blocks.length }, 'Translation job completed')
  } catch (error) {
    logger.error({ error, projectId }, 'Translation job failed')
    throw error
  }
}

/**
 * Process render job for a page
 */
export async function processRenderJob(pageId: string, projectId: string) {
  logger.info({ pageId, projectId }, 'Starting render job')

  try {
    // Get page and text blocks
    const { data: page } = await supabaseAdmin
      .from('pages')
      .select('*')
      .eq('id', pageId)
      .single()

    const { data: textBlocks } = await supabaseAdmin
      .from('text_blocks')
      .select('*')
      .eq('page_id', pageId)
      .eq('status', 'translated')

    if (!page || !textBlocks) {
      throw new Error('Page or text blocks not found')
    }

    // Fetch original image
    const imageResponse = await fetch((page as any).original_blob_url)
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())

    // Render page
    const renderedBuffer = await renderPage(
      imageBuffer,
      textBlocks as any,
      { maskOriginalText: true }
    )

    // Upload rendered image
    // @ts-expect-error - Vercel Blob type compatibility
    const blob = await put(`rendered/${projectId}/${pageId}.png`, renderedBuffer, {
      access: 'public',
    })

    // Update page
    await supabaseAdmin
      .from('pages')
      // @ts-expect-error - Supabase type inference issue
      .update({ processed_blob_url: blob.url })
      .eq('id', pageId)

    logger.info({ pageId }, 'Render job completed')
  } catch (error) {
    logger.error({ error, pageId }, 'Render job failed')
    throw error
  }
}
