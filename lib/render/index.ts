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

    // Calculate font size to fit the bounding box
    const fontSize = calculateFontSize(text, bbox)

    // Handle vertical text
    const transform = block.is_vertical
      ? `translate(${bbox.x + bbox.width / 2}, ${bbox.y}) rotate(0)`
      : `translate(${bbox.x}, ${bbox.y + bbox.height / 2})`

    // Render text with optional stroke
    const strokeAttrs = options.strokeWidth
      ? `stroke="${options.strokeColor || 'black'}" stroke-width="${options.strokeWidth}"`
      : ''

    const textElement = `
      <text
        x="0"
        y="0"
        font-family="${block.font_family || 'Arial, sans-serif'}"
        font-size="${fontSize}"
        text-anchor="${block.text_align || 'middle'}"
        dominant-baseline="middle"
        fill="black"
        ${strokeAttrs}
        transform="${transform}"
        writing-mode="${block.is_vertical ? 'tb' : 'lr'}"
      >
        ${escapeXml(text)}
      </text>
    `

    elements.push(textElement)
  }

  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      ${elements.join('\n')}
    </svg>
  `
}

/**
 * Calculate optimal font size to fit text in bounding box
 */
function calculateFontSize(text: string, bbox: BoundingBox): number {
  const charCount = text.length
  const area = bbox.width * bbox.height

  // Simple heuristic: scale font size based on available area
  let fontSize = Math.sqrt(area / charCount) * 1.5

  // Clamp between reasonable limits
  fontSize = Math.max(10, Math.min(fontSize, 48))

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
