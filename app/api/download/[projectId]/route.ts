import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import JSZip from 'jszip'
import sharp from 'sharp'

export const runtime = 'nodejs'
export const maxDuration = 60

interface RouteContext {
  params: Promise<{ projectId: string }>
}

interface BBox {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Split text into multiple lines to fit within bbox width
 */
function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  const lines: string[] = []
  const chars = text.split('')

  // Estimate character width (Chinese chars are roughly square, fontSize * 0.9)
  const charWidth = fontSize * 0.9
  const maxCharsPerLine = Math.floor(maxWidth / charWidth)

  if (maxCharsPerLine < 1) {
    return [text]
  }

  let currentLine = ''

  for (const char of chars) {
    if (currentLine.length >= maxCharsPerLine) {
      lines.push(currentLine)
      currentLine = char
    } else {
      currentLine += char
    }
  }

  if (currentLine) {
    lines.push(currentLine)
  }

  return lines
}

async function renderTranslatedImage(
  originalImageBuffer: Buffer,
  textBlocks: Array<{ bbox: BBox; translated_text: string }>
): Promise<Buffer> {
  console.log(`Rendering ${textBlocks.length} text blocks onto image`)

  const image = sharp(originalImageBuffer)
  const metadata = await image.metadata()

  if (!metadata.width || !metadata.height) {
    throw new Error('Invalid image metadata')
  }

  console.log(`Image dimensions: ${metadata.width}x${metadata.height}`)

  // Filter valid text blocks
  const validBlocks = textBlocks.filter((block) => block.translated_text && block.translated_text.trim())
  console.log(`Valid text blocks: ${validBlocks.length}`)

  if (validBlocks.length === 0) {
    console.log('No valid text blocks, returning original image')
    return originalImageBuffer
  }

  // Create SVG overlay with translated text
  const svgOverlays = validBlocks.map((block) => {
    const { bbox, translated_text } = block

    console.log(`Text block: "${translated_text}" at (${bbox.x}, ${bbox.y}) size ${bbox.width}x${bbox.height}`)

    // Escape XML special characters
    const escapedText = translated_text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')

    // Calculate appropriate font size
    let fontSize = Math.max(16, Math.floor(bbox.height * 0.5))

    // Wrap text into multiple lines
    const lines = wrapText(escapedText, bbox.width * 0.9, fontSize)

    // Adjust font size if too many lines
    const lineHeight = fontSize * 1.2
    const totalHeight = lines.length * lineHeight

    if (totalHeight > bbox.height * 0.9) {
      fontSize = Math.max(12, Math.floor((bbox.height * 0.9) / (lines.length * 1.2)))
    }

    const adjustedLineHeight = fontSize * 1.2
    const startY = bbox.y + (bbox.height - lines.length * adjustedLineHeight) / 2 + fontSize * 0.8

    // Create white background rectangle
    const rect = `<rect x="${bbox.x}" y="${bbox.y}" width="${bbox.width}" height="${bbox.height}" fill="white" opacity="0.95"/>`

    // Create text lines with Chinese font support
    const textLines = lines.map((line, index) => {
      const y = startY + index * adjustedLineHeight
      return `<text
        x="${bbox.x + bbox.width / 2}"
        y="${y}"
        font-family="Noto Sans SC, Microsoft YaHei, SimHei, sans-serif"
        font-size="${fontSize}"
        fill="black"
        text-anchor="middle"
        font-weight="500"
      >${line}</text>`
    }).join('\n')

    return rect + '\n' + textLines
  }).join('\n')

  const svg = `
    <svg width="${metadata.width}" height="${metadata.height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&amp;display=swap');
        </style>
      </defs>
      ${svgOverlays}
    </svg>
  `

  console.log('SVG generated, compositing...')

  // Composite the SVG overlay on top of the original image
  const result = await image
    .composite([
      {
        input: Buffer.from(svg),
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toBuffer()

  console.log('Image rendering complete')
  return result
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { projectId } = await context.params

    // Get project details
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (project.status !== 'ready') {
      return NextResponse.json(
        { error: 'Project translation not completed yet' },
        { status: 400 }
      )
    }

    // Get all pages
    const { data: pages, error: pagesError } = await supabaseAdmin
      .from('pages')
      .select('*')
      .eq('project_id', projectId)
      .order('page_index')

    if (pagesError || !pages || pages.length === 0) {
      return NextResponse.json({ error: 'No pages found' }, { status: 404 })
    }

    // Create a ZIP archive using JSZip
    const zip = new JSZip()

    // Process each page and add translated image to ZIP
    for (const page of pages) {
      try {
        // Read original image
        let originalImageBuffer: Buffer

        // Check if URL is from Supabase Storage or local
        if (page.original_blob_url.startsWith('http')) {
          // Fetch from Supabase Storage or external URL
          const response = await fetch(page.original_blob_url)
          if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`)
          }
          originalImageBuffer = Buffer.from(await response.arrayBuffer())
        } else {
          // Read from local filesystem
          const imagePath = join(process.cwd(), 'public', page.original_blob_url)
          originalImageBuffer = await readFile(imagePath)
        }

        // Get text blocks for this page
        console.log(`Getting text blocks for page ${page.id}`)
        const { data: textBlocks, error: textBlocksError } = await supabaseAdmin
          .from('text_blocks')
          .select('bbox, translated_text')
          .eq('page_id', page.id)

        if (textBlocksError) {
          console.error(`Failed to get text blocks for page ${page.id}:`, textBlocksError)
          // If no text blocks, use original image
          const fileName = `page_${String(page.page_index + 1).padStart(3, '0')}.png`
          zip.file(fileName, originalImageBuffer)
          continue
        }

        console.log(`Found ${textBlocks?.length || 0} text blocks for page ${page.page_index}`)

        // Render translated image
        if (textBlocks && textBlocks.length > 0) {
          console.log(`Rendering translated image for page ${page.page_index}`)
          const translatedImageBuffer = await renderTranslatedImage(
            originalImageBuffer,
            textBlocks
          )
          const fileName = `page_${String(page.page_index + 1).padStart(3, '0')}.png`
          zip.file(fileName, translatedImageBuffer)
          console.log(`Added translated page ${page.page_index} to ZIP`)
        } else {
          // No text blocks, use original image
          console.log(`No text blocks found, using original image for page ${page.page_index}`)
          const fileName = `page_${String(page.page_index + 1).padStart(3, '0')}.png`
          zip.file(fileName, originalImageBuffer)
        }
      } catch (err) {
        console.error(`Failed to process page ${page.page_index}:`, err)
      }
    }

    // Generate the ZIP file as a buffer
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })

    // Return the ZIP file
    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${project.title}_translated.zip"`,
      },
    })
  } catch (error) {
    console.error('Download failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Download failed' },
      { status: 500 }
    )
  }
}
