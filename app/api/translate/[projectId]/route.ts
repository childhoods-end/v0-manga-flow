import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { performOCR } from '@/lib/ocr'
import { translateBlocks } from '@/lib/translate'
import sharp from 'sharp'
import { readFile } from 'fs/promises'
import { join } from 'path'

export const runtime = 'nodejs'
export const maxDuration = 300

interface RouteContext {
  params: Promise<{
    projectId: string
  }>
}

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const { projectId } = await context.params

  try {
    console.log('Starting translation for project:', projectId)

    // 1. Get project details
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

    // 2. Get all pages for this project
    const { data: pages, error: pagesError } = await supabaseAdmin
      .from('pages')
      .select('*')
      .eq('project_id', projectId)
      .order('page_index')

    if (pagesError || !pages || pages.length === 0) {
      return NextResponse.json(
        { error: 'No pages found for this project' },
        { status: 404 }
      )
    }

    console.log(`Found ${pages.length} pages to translate`)

    // 3. Update project status
    await supabaseAdmin
      .from('projects')
      .update({ status: 'processing' })
      .eq('id', projectId)

    // 4. Process each page
    const results = []

    for (const page of pages) {
      try {
        console.log(`Processing page ${page.page_index + 1}/${pages.length}`)

        // Get image buffer
        let imageBuffer: Buffer

        // Check if URL is from Supabase Storage or local
        if (page.original_blob_url.startsWith('http')) {
          // Fetch from Supabase Storage or external URL
          console.log('Fetching image from URL:', page.original_blob_url)
          const response = await fetch(page.original_blob_url)
          if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`)
          }
          imageBuffer = Buffer.from(await response.arrayBuffer())
        } else {
          // Read from local filesystem
          console.log('Reading image from local filesystem')
          const imagePath = join(process.cwd(), 'public', page.original_blob_url)
          imageBuffer = await readFile(imagePath)
        }

        // Perform OCR
        console.log('Performing OCR...')
        const ocrResults = await performOCR(imageBuffer, 'tesseract', {
          language: getOCRLanguageCode(project.source_language),
        })

        console.log(`Found ${ocrResults.length} text blocks`)

        if (ocrResults.length === 0) {
          results.push({
            pageId: page.id,
            pageIndex: page.page_index,
            status: 'no_text_found',
            textBlocks: 0,
          })
          continue
        }

        // Translate text blocks
        console.log('Translating text blocks...')
        const translationBlocks = ocrResults.map((ocr, index) => ({
          id: `${page.id}-${index}`,
          text: ocr.text,
        }))

        const translations = await translateBlocks(
          translationBlocks,
          project.source_language,
          project.target_language,
          process.env.DEFAULT_TRANSLATION_PROVIDER as any
        )

        console.log('Translation completed')

        // Save text blocks to database
        const textBlocksToInsert = ocrResults.map((ocr, index) => ({
          page_id: page.id,
          bbox: ocr.bbox,
          ocr_text: ocr.text,
          translated_text: translations[index]?.translatedText || '',
          confidence: ocr.confidence,
          status: 'translated',
        }))

        const { error: insertError } = await supabaseAdmin
          .from('text_blocks')
          .insert(textBlocksToInsert)

        if (insertError) {
          console.error('Failed to save text blocks:', insertError)
        }

        results.push({
          pageId: page.id,
          pageIndex: page.page_index,
          status: 'success',
          textBlocks: ocrResults.length,
          translations: translations.length,
        })
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

    // 5. Update project status
    const successCount = results.filter(r => r.status === 'success').length
    const finalStatus = successCount === pages.length ? 'ready' : 'failed'

    await supabaseAdmin
      .from('projects')
      .update({
        status: finalStatus,
        processed_pages: successCount,
      })
      .eq('id', projectId)

    console.log('Translation completed:', {
      total: pages.length,
      success: successCount,
      failed: pages.length - successCount,
    })

    return NextResponse.json({
      success: true,
      projectId,
      totalPages: pages.length,
      processedPages: successCount,
      results,
    })
  } catch (error) {
    console.error('Translation failed:', error)

    // Update project status to failed
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
