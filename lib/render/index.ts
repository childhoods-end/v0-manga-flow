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

    // Calculate optimal font size
    const fontSize = calculateFontSize(text, bbox)

    // Split text into lines that fit the bounding box
    const lines = wrapText(text, bbox.width * 0.9, fontSize)

    // Calculate line height (1.2x font size is standard)
    const lineHeight = fontSize * 1.2
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
  const availableWidth = bbox.width * 0.9 // 90% to leave some padding
  const availableHeight = bbox.height * 0.9

  // Initial estimate based on area and character count
  let fontSize = Math.sqrt((bbox.width * bbox.height) / charCount) * 1.8

  // For Chinese/Japanese characters, they tend to be wider
  const hasCJK = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/.test(text)
  if (hasCJK) {
    // CJK characters need more space
    fontSize *= 0.85
  }

  // Estimate text dimensions at this font size
  // Rough approximation: char width ≈ fontSize * 0.6 for latin, fontSize * 1.0 for CJK
  const avgCharWidth = hasCJK ? fontSize * 1.0 : fontSize * 0.6
  const lineHeight = fontSize * 1.2

  // Estimate how many characters fit per line
  const charsPerLine = Math.floor(availableWidth / avgCharWidth)
  const estimatedLines = Math.ceil(charCount / charsPerLine)
  const estimatedHeight = estimatedLines * lineHeight

  // If text would overflow height, reduce font size
  if (estimatedHeight > availableHeight) {
    const heightRatio = availableHeight / estimatedHeight
    fontSize *= Math.sqrt(heightRatio) // Use sqrt for gentler scaling
  }

  // If text would overflow width (very long single words), reduce font size
  const maxWordLength = Math.max(...text.split(/\s+/).map(w => w.length))
  const maxWordWidth = maxWordLength * avgCharWidth
  if (maxWordWidth > availableWidth) {
    const widthRatio = availableWidth / maxWordWidth
    fontSize *= widthRatio
  }

  // Clamp between reasonable limits
  // Min: 8px (readable minimum), Max: 72px (for very short text in large bubbles)
  fontSize = Math.max(8, Math.min(fontSize, 72))

  return Math.floor(fontSize)
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
