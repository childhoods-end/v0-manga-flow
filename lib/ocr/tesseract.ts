import { createWorker, PSM, OEM } from 'tesseract.js'
import type { OCRProvider, OCRResult, OCROptions } from './index'
import logger from '@/lib/logger'

export const tesseractProvider: OCRProvider = {
  name: 'tesseract',

  async recognize(imageBuffer: Buffer, options?: OCROptions): Promise<OCRResult[]> {
    const worker: any = await createWorker()

    try {
      const language = options?.language || 'jpn+eng'

      await worker.loadLanguage(language)
      await worker.initialize(language)

      // Configure worker
      await worker.setParameters({
        tessedit_ocr_engine_mode: options?.oem ?? OEM.LSTM_ONLY,
        tessedit_pageseg_mode: options?.psm ?? PSM.AUTO,
      })

      logger.info({ language, oem: options?.oem, psm: options?.psm }, 'Starting OCR with Tesseract')

      const { data } = await worker.recognize(imageBuffer)

      // Extract text blocks with bounding boxes
      const results: OCRResult[] = []

      if (data.words) {
        for (const word of data.words) {
          if (!word.text.trim()) continue

          results.push({
            text: word.text,
            confidence: word.confidence / 100, // Convert to 0-1 range
            bbox: {
              x: word.bbox.x0,
              y: word.bbox.y0,
              width: word.bbox.x1 - word.bbox.x0,
              height: word.bbox.y1 - word.bbox.y0,
              rotation: 0,
            },
          })
        }
      }

      // Group nearby words into lines
      const groupedResults = groupWordsIntoBlocks(results)

      logger.info({ blockCount: groupedResults.length }, 'OCR completed')

      return groupedResults
    } catch (error) {
      logger.error({ error }, 'Tesseract OCR failed')
      throw error
    } finally {
      await worker.terminate()
    }
  },
}

/**
 * Estimate font size from bounding box dimensions
 */
function estimateFontSize(bbox: { width: number; height: number }, textLength: number): number {
  // For horizontal text, height is a good indicator
  // For vertical text, width is better
  // Simple heuristic: use the smaller dimension and adjust by character count
  const avgDimension = Math.sqrt(bbox.width * bbox.height / Math.max(textLength, 1))
  return Math.max(8, Math.min(Math.round(avgDimension * 0.8), 120))
}

/**
 * Detect text orientation based on bbox dimensions
 */
function detectOrientation(bbox: { width: number; height: number }): 'horizontal' | 'vertical' {
  // If height > width significantly, likely vertical
  return bbox.height > bbox.width * 1.5 ? 'vertical' : 'horizontal'
}

/**
 * Group nearby words into text blocks
 */
function groupWordsIntoBlocks(words: OCRResult[]): OCRResult[] {
  if (words.length === 0) return []

  // Sort by y-position first, then x-position
  const sorted = [...words].sort((a, b) => {
    const yDiff = a.bbox.y - b.bbox.y
    if (Math.abs(yDiff) > 20) return yDiff
    return a.bbox.x - b.bbox.x
  })

  const blocks: OCRResult[] = []
  let currentBlock: OCRResult | null = null

  for (const word of sorted) {
    if (!currentBlock) {
      currentBlock = { ...word }
      continue
    }

    // Check if this word is on the same line (within 20px vertical distance)
    const verticalDistance = Math.abs(word.bbox.y - currentBlock.bbox.y)
    const horizontalGap = word.bbox.x - (currentBlock.bbox.x + currentBlock.bbox.width)

    if (verticalDistance < 20 && horizontalGap < 50) {
      // Merge words into a block
      currentBlock.text += ' ' + word.text
      currentBlock.confidence = (currentBlock.confidence + word.confidence) / 2

      // Expand bounding box
      const right = Math.max(
        currentBlock.bbox.x + currentBlock.bbox.width,
        word.bbox.x + word.bbox.width
      )
      const bottom = Math.max(
        currentBlock.bbox.y + currentBlock.bbox.height,
        word.bbox.y + word.bbox.height
      )

      currentBlock.bbox.width = right - currentBlock.bbox.x
      currentBlock.bbox.height = bottom - currentBlock.bbox.y
    } else {
      // Start a new block
      blocks.push(currentBlock)
      currentBlock = { ...word }
    }
  }

  if (currentBlock) {
    blocks.push(currentBlock)
  }

  // Add font size and orientation to each block
  return blocks.map(block => ({
    ...block,
    fontSize: estimateFontSize(block.bbox, block.text.length),
    orientation: detectOrientation(block.bbox)
  }))
}
