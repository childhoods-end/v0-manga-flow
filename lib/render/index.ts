import sharp from 'sharp'
import type { TextBlock, BoundingBox } from '@/lib/database.types'
import logger from '@/lib/logger'

export interface RenderOptions {
  maskOriginalText?: boolean
  backgroundColor?: string
  strokeColor?: string
  strokeWidth?: number
}

export interface TextBlockWithTranslation extends Omit<TextBlock, 'bbox'> {
  bbox: BoundingBox
}

/**
 * Render translated text over the original manga page
 * Returns a buffer of the rendered image
 */
export async function renderPage(
  originalImageBuffer: Buffer,
  textBlocks: TextBlockWithTranslation[],
  options: RenderOptions = {}
): Promise<Buffer> {
  try {
    // Get image metadata
    const metadata = await sharp(originalImageBuffer).metadata()
    const width = metadata.width!
    const height = metadata.height!

    logger.info({ width, height, blockCount: textBlocks.length }, 'Starting page render')

    // Create SVG overlay with all text blocks
    const svgOverlay = generateSvgOverlay(width, height, textBlocks, options)

    // Composite SVG over original image
    const rendered = await sharp(originalImageBuffer)
      .composite([
        {
          input: Buffer.from(svgOverlay),
          top: 0,
          left: 0,
        },
      ])
      .png()
      .toBuffer()

    logger.info('Page render completed')

    return rendered
  } catch (error) {
    logger.error({ error }, 'Page render failed')
    throw error
  }
}

/**
 * Generate SVG overlay with all text blocks
 */
function generateSvgOverlay(
  width: number,
  height: number,
  textBlocks: TextBlockWithTranslation[],
  options: RenderOptions
): string {
  const elements: string[] = []

  for (const block of textBlocks) {
    if (!block.translated_text) continue

    const { bbox } = block
    const text = block.translated_text

    // If masking original text, draw a white rectangle first
    if (options.maskOriginalText) {
      elements.push(`
        <rect
          x="${bbox.x}"
          y="${bbox.y}"
          width="${bbox.width}"
          height="${bbox.height}"
          fill="${options.backgroundColor || 'white'}"
        />
      `)
    }

    // Use custom font size if provided, otherwise calculate
    const fontSize = block.font_size && block.font_size > 0
      ? block.font_size
      : calculateFontSize(text, bbox)

    // Split text into lines that fit the bounding box (use 98% width)
    const lines = wrapText(text, bbox.width * 0.98, fontSize)

    // Calculate line height (1.1x font size for tighter spacing)
    const lineHeight = fontSize * 1.1
    const totalHeight = lines.length * lineHeight

    // Center text block vertically within bbox
    const startY = bbox.y + (bbox.height - totalHeight) / 2 + lineHeight / 2

    // Render text with optional stroke
    const strokeAttrs = options.strokeWidth
      ? `stroke="${options.strokeColor || 'black'}" stroke-width="${options.strokeWidth}"`
      : ''

    // Render each line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const yPos = startY + i * lineHeight

      const textElement = `
        <text
          x="${bbox.x + bbox.width / 2}"
          y="${yPos}"
          font-family="${block.font_family || 'Arial, Noto Sans CJK SC, sans-serif'}"
          font-size="${fontSize}"
          text-anchor="middle"
          dominant-baseline="middle"
          fill="black"
          ${strokeAttrs}
        >
          ${escapeXml(line)}
        </text>
      `

      elements.push(textElement)
    }
  }

  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      ${elements.join('\n')}
    </svg>
  `
}

/**
 * Wrap text into multiple lines that fit within the specified width
 */
function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  const hasCJK = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/.test(text)
  const avgCharWidth = hasCJK ? fontSize * 1.0 : fontSize * 0.6
  const maxCharsPerLine = Math.floor(maxWidth / avgCharWidth)

  if (maxCharsPerLine <= 0) return [text]

  const lines: string[] = []
  let currentLine = ''

  // Split by existing line breaks first
  const paragraphs = text.split(/\n/)

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/(\s+)/)

    for (const word of words) {
      const testLine = currentLine + word
      const estimatedWidth = testLine.length * avgCharWidth

      if (estimatedWidth > maxWidth && currentLine.length > 0) {
        // Line would be too long, push current line and start new one
        lines.push(currentLine.trim())
        currentLine = word
      } else {
        currentLine += word
      }
    }

    // Push remaining text as a line
    if (currentLine.trim()) {
      lines.push(currentLine.trim())
      currentLine = ''
    }
  }

  return lines.length > 0 ? lines : [text]
}

/**
 * Calculate optimal font size to fit text in bounding box
 * Uses iterative approach to maximize font size while fitting content
 */
function calculateFontSize(text: string, bbox: BoundingBox): number {
  const charCount = text.length
  if (charCount === 0) return 16

  // Use 98% of available space (minimal padding)
  const availableWidth = bbox.width * 0.98
  const availableHeight = bbox.height * 0.98

  // Very aggressive initial estimate - maximize font size
  let fontSize = Math.sqrt((bbox.width * bbox.height) / charCount) * 2.8

  // For Chinese/Japanese characters
  const hasCJK = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/.test(text)

  // CJK characters are roughly square (width ≈ height ≈ fontSize)
  // Latin characters are narrower (width ≈ 0.5-0.6 of fontSize)
  const avgCharWidth = hasCJK ? fontSize * 1.0 : fontSize * 0.55

  // Tight line height for better space utilization
  const lineHeight = fontSize * 1.1

  // Calculate how text would fit
  const charsPerLine = Math.max(1, Math.floor(availableWidth / avgCharWidth))
  const estimatedLines = Math.ceil(charCount / charsPerLine)
  const estimatedHeight = estimatedLines * lineHeight

  // If text would overflow, scale down proportionally
  if (estimatedHeight > availableHeight) {
    const heightRatio = availableHeight / estimatedHeight
    fontSize *= heightRatio
  }

  // Check for very long words that wouldn't fit
  const words = text.split(/\s+/)
  if (words.length > 0) {
    const maxWordLength = Math.max(...words.map(w => w.length))
    const maxWordWidth = maxWordLength * avgCharWidth

    if (maxWordWidth > availableWidth) {
      const widthRatio = availableWidth / maxWordWidth
      fontSize *= widthRatio
    }
  }

  // Clamp to reasonable range
  // Min: 12px (readable), Max: 100px (very short text in large bubbles)
  fontSize = Math.max(12, Math.min(fontSize, 100))

  const finalFontSize = Math.floor(fontSize)

  // DEBUG: Log font size calculations
  console.log('📏 Font Size Calculation:', {
    text: text.substring(0, 30) + (text.length > 30 ? '...' : ''),
    charCount,
    bbox: { w: bbox.width, h: bbox.height, area: bbox.width * bbox.height },
    hasCJK,
    initialFontSize: Math.floor(Math.sqrt((bbox.width * bbox.height) / charCount) * 2.8),
    finalFontSize,
    estimatedLines,
    lineHeight: Math.floor(lineHeight),
  })

  return finalFontSize
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Generate thumbnail for a page
 */
export async function generateThumbnail(
  imageBuffer: Buffer,
  maxWidth: number = 300
): Promise<Buffer> {
  return sharp(imageBuffer)
    .resize(maxWidth, null, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 80 })
    .toBuffer()
}
