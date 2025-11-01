import sharp from 'sharp'
import type { TextBlock, BoundingBox } from '@/lib/database.types'
import logger from '@/lib/logger'
import { createCanvas, loadImage, CanvasRenderingContext2D } from '@napi-rs/canvas'
import { drawTextInRect, LayoutOptions } from '@/lib/canvasText'

export interface SmartRenderOptions {
  maskOriginalText?: boolean
  backgroundColor?: string
  fontFamily?: string
  maxFont?: number
  minFont?: number
  lineHeight?: number
  padding?: number
  textAlign?: CanvasTextAlign
  verticalAlign?: 'top' | 'middle' | 'bottom'
  maxLines?: number
  overflowStrategy?: 'shrink' | 'ellipsis'
  fillStyle?: string
  shadowColor?: string
  shadowBlur?: number
  lang?: 'auto' | 'zh' | 'en'
}

export interface TextBlockWithTranslation extends Omit<TextBlock, 'bbox'> {
  bbox: BoundingBox
}

/**
 * Render translated text using smart Canvas-based text layout
 * Provides better CJK font support and intelligent text wrapping
 *
 * This is the high-quality server-side renderer using @napi-rs/canvas
 */
export async function renderPageSmart(
  originalImageBuffer: Buffer,
  textBlocks: TextBlockWithTranslation[],
  options: SmartRenderOptions = {}
): Promise<Buffer> {
  try {
    // Get image metadata
    const metadata = await sharp(originalImageBuffer).metadata()
    const width = metadata.width!
    const height = metadata.height!

    logger.info({ width, height, blockCount: textBlocks.length }, 'Starting smart page render')

    // Create canvas
    const canvas = createCanvas(width, height)
    const ctx = canvas.getContext('2d')

    // Draw original image as background
    const image = await loadImage(originalImageBuffer)
    ctx.drawImage(image, 0, 0, width, height)

    // Apply text blocks with smart layout
    for (const block of textBlocks) {
      // Skip blocks without translated text
      if (!block.translated_text || block.translated_text.trim() === '') continue

      const { bbox } = block
      const text = block.translated_text
      const isVertical = (block as any).text_orientation === 'vertical'

      // If masking original text, draw background rectangle
      if (options.maskOriginalText) {
        ctx.fillStyle = options.backgroundColor || 'rgba(255, 255, 255, 0.92)'
        ctx.fillRect(bbox.x, bbox.y, bbox.width, bbox.height)
      }

      const fontFamily = options.fontFamily || 'system-ui, -apple-system, "Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", sans-serif'

      if (isVertical) {
        // Vertical text rendering (top to bottom)
        // Use stored font_size if available, otherwise calculate from bbox
        const fontSize = (block as any).font_size && (block as any).font_size > 0
          ? (block as any).font_size
          : Math.round(bbox.width * 0.35)

        ctx.font = `${fontSize}px ${fontFamily}`
        ctx.fillStyle = options.fillStyle || '#000000'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        const chars = text.split('')
        const charHeight = fontSize * 1.1
        const totalHeight = chars.length * charHeight
        const startY = bbox.y + (bbox.height - totalHeight) / 2 + charHeight / 2
        const centerX = bbox.x + bbox.width / 2

        for (let i = 0; i < chars.length; i++) {
          const y = startY + i * charHeight
          ctx.fillText(chars[i], centerX, y)
        }
      } else {
        // Horizontal text rendering using smart layout
        const layoutOpts: LayoutOptions = {
          fontFamily,
          maxFont: options.maxFont || 36,
          minFont: options.minFont || 10,
          lineHeight: options.lineHeight || 1.45,
          padding: options.padding || 12,
          textAlign: options.textAlign || 'center',
          verticalAlign: options.verticalAlign || 'middle',
          maxLines: options.maxLines || 3,
          overflowStrategy: options.overflowStrategy || 'ellipsis',
          fillStyle: options.fillStyle || '#111',
          shadowColor: options.shadowColor || 'rgba(255,255,255,0.9)',
          shadowBlur: options.shadowBlur !== undefined ? options.shadowBlur : 2,
          lang: options.lang || 'auto',
        }

        drawTextInRect(ctx, text, bbox, layoutOpts)
      }
    }

    // Convert canvas to buffer
    const buffer = canvas.toBuffer('image/png')

    logger.info('Smart page render completed')

    return buffer
  } catch (error) {
    logger.error({ error }, 'Smart page render failed')
    throw error
  }
}

/**
 * Draw a rounded rectangle
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}
