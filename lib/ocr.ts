import Tesseract from 'tesseract.js'
import vision from '@google-cloud/vision'

export type OCRProvider = 'tesseract' | 'google' | 'azure'

export interface BBox {
  x: number
  y: number
  width: number
  height: number
}

export interface OCRResult {
  text: string
  bbox: BBox
  confidence: number
}

export interface OCROptions {
  language?: string
  minConfidence?: number
}

/**
 * Perform OCR on an image buffer
 */
export async function performOCR(
  imageBuffer: Buffer,
  provider: OCRProvider = 'tesseract',
  options: OCROptions = {}
): Promise<OCRResult[]> {
  switch (provider) {
    case 'tesseract':
      return performTesseractOCR(imageBuffer, options)
    case 'google':
      return performGoogleVisionOCR(imageBuffer, options)
    case 'azure':
      throw new Error('Azure OCR not implemented yet')
    default:
      throw new Error(`Unsupported OCR provider: ${provider}`)
  }
}

/**
 * Perform OCR using Tesseract.js
 */
async function performTesseractOCR(
  imageBuffer: Buffer,
  options: OCROptions = {}
): Promise<OCRResult[]> {
  const { language = 'kor+eng', minConfidence = 60 } = options

  try {
    console.log(`Starting Tesseract OCR with language: ${language}`)
    const startTime = Date.now()

    const worker = await Tesseract.createWorker(language, undefined, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`)
        }
      },
    })

    // Use faster OCR settings for serverless environment
    await worker.setParameters({
      tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT, // Faster than AUTO
      tessedit_char_whitelist: '', // No whitelist for better accuracy
    })

    const {
      data: { words },
    } = await worker.recognize(imageBuffer)

    await worker.terminate()

    const elapsed = Math.round((Date.now() - startTime) / 1000)
    console.log(`Tesseract found ${words.length} words in ${elapsed}s`)

    // Group words into text blocks (lines)
    const lines = groupWordsIntoLines(words, minConfidence)

    console.log(`Grouped into ${lines.length} text blocks`)

    return lines
  } catch (error) {
    console.error('Tesseract OCR error:', error)
    throw new Error(
      `Tesseract OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Group Tesseract words into lines based on vertical proximity
 */
function groupWordsIntoLines(
  words: Tesseract.Word[],
  minConfidence: number
): OCRResult[] {
  // Filter out low confidence words
  const validWords = words.filter((word) => word.confidence >= minConfidence && word.text.trim())

  if (validWords.length === 0) {
    return []
  }

  // Sort words by vertical position (top to bottom, left to right)
  const sortedWords = [...validWords].sort((a, b) => {
    const verticalDiff = a.bbox.y0 - b.bbox.y0
    if (Math.abs(verticalDiff) < 20) {
      // Same line, sort by horizontal position
      return a.bbox.x0 - b.bbox.x0
    }
    return verticalDiff
  })

  // Group words into lines
  const lines: OCRResult[] = []
  let currentLine: Tesseract.Word[] = []
  let currentLineY = sortedWords[0].bbox.y0

  for (const word of sortedWords) {
    const wordY = word.bbox.y0
    const lineHeight = currentLine.length > 0 ? currentLine[0].bbox.y1 - currentLine[0].bbox.y0 : 20

    // Check if word belongs to current line (within line height threshold)
    if (Math.abs(wordY - currentLineY) < lineHeight * 0.5) {
      currentLine.push(word)
    } else {
      // Start a new line
      if (currentLine.length > 0) {
        lines.push(createLineFromWords(currentLine))
      }
      currentLine = [word]
      currentLineY = wordY
    }
  }

  // Add the last line
  if (currentLine.length > 0) {
    lines.push(createLineFromWords(currentLine))
  }

  return lines
}

/**
 * Create a single OCR result from multiple words in a line
 */
function createLineFromWords(words: Tesseract.Word[]): OCRResult {
  const text = words.map((w) => w.text).join(' ')

  // Calculate bounding box
  const x0 = Math.min(...words.map((w) => w.bbox.x0))
  const y0 = Math.min(...words.map((w) => w.bbox.y0))
  const x1 = Math.max(...words.map((w) => w.bbox.x1))
  const y1 = Math.max(...words.map((w) => w.bbox.y1))

  // Calculate average confidence
  const avgConfidence = words.reduce((sum, w) => sum + w.confidence, 0) / words.length

  return {
    text: text.trim(),
    bbox: {
      x: x0,
      y: y0,
      width: x1 - x0,
      height: y1 - y0,
    },
    confidence: avgConfidence,
  }
}

/**
 * Perform OCR using Google Cloud Vision API
 */
async function performGoogleVisionOCR(
  imageBuffer: Buffer,
  options: OCROptions = {}
): Promise<OCRResult[]> {
  const { minConfidence = 60 } = options

  try {
    console.log('Starting Google Cloud Vision OCR')
    const startTime = Date.now()

    // Initialize Google Vision client with credentials from env
    const credentialsJson = process.env.GOOGLE_CLOUD_VISION_KEY

    if (!credentialsJson) {
      throw new Error('GOOGLE_CLOUD_VISION_KEY environment variable not set')
    }

    const credentials = JSON.parse(credentialsJson)

    const client = new vision.ImageAnnotatorClient({
      projectId: credentials.project_id,
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key,
      },
    })

    // Perform text detection
    const [result] = await client.textDetection({
      image: { content: imageBuffer },
    })

    const detections = result.textAnnotations

    if (!detections || detections.length === 0) {
      console.log('Google Vision found no text')
      return []
    }

    // Use full text detection to get paragraphs
    const [fullResult] = await client.documentTextDetection({
      image: { content: imageBuffer },
    })

    const pages = fullResult.fullTextAnnotation?.pages || []
    const allTextBlocks: OCRResult[] = []

    if (pages.length > 0) {
      // Use structured text blocks from document detection
      for (const page of pages) {
        for (const block of page.blocks || []) {
          // Each block represents a coherent text region (like a speech bubble)
          const blockTexts: string[] = []
          const vertices = block.boundingBox?.vertices || []

          // Collect all text from paragraphs in this block
          for (const paragraph of block.paragraphs || []) {
            const words = paragraph.words || []
            const paragraphText = words
              .map((word) => {
                const symbols = word.symbols || []
                return symbols.map((s) => s.text || '').join('')
              })
              .join('')

            if (paragraphText.trim()) {
              blockTexts.push(paragraphText.trim())
            }
          }

          if (blockTexts.length > 0 && vertices.length >= 4) {
            const xs = vertices.map((v) => v.x || 0)
            const ys = vertices.map((v) => v.y || 0)

            const x = Math.min(...xs)
            const y = Math.min(...ys)
            const width = Math.max(...xs) - x
            const height = Math.max(...ys) - y

            allTextBlocks.push({
              text: blockTexts.join(' '),
              bbox: { x, y, width, height },
              confidence: block.confidence ? block.confidence * 100 : 90,
            })
          }
        }
      }
    }

    // Fallback to word-level detection if no blocks found
    if (allTextBlocks.length === 0 && detections && detections.length > 1) {
      console.log('No structured blocks, falling back to word grouping')
      const textBlocks = detections.slice(1).map((annotation) => {
        const vertices = annotation.boundingPoly?.vertices || []
        if (vertices.length < 4) return null

        const xs = vertices.map((v) => v.x || 0)
        const ys = vertices.map((v) => v.y || 0)

        return {
          text: annotation.description || '',
          bbox: {
            x: Math.min(...xs),
            y: Math.min(...ys),
            width: Math.max(...xs) - Math.min(...xs),
            height: Math.max(...ys) - Math.min(...ys),
          },
          confidence: (annotation.confidence || 0.9) * 100,
        }
      }).filter((block): block is OCRResult => block !== null && block.text.trim() !== '')

      const elapsed = Math.round((Date.now() - startTime) / 1000)
      console.log(`Google Vision found ${textBlocks.length} word blocks in ${elapsed}s`)
      return groupTextBlocksIntoSpeechBubbles(textBlocks)
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000)
    console.log(`Google Vision found ${allTextBlocks.length} text blocks in ${elapsed}s`)

    return allTextBlocks
  } catch (error) {
    console.error('Google Vision OCR error:', error)
    throw new Error(
      `Google Vision OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Detect if text blocks are arranged vertically (common in manga)
 */
function isVerticalText(blocks: OCRResult[]): boolean {
  if (blocks.length < 2) return false

  let verticalCount = 0
  let horizontalCount = 0

  for (let i = 0; i < blocks.length - 1; i++) {
    const curr = blocks[i]
    const next = blocks[i + 1]

    const horizontalDist = Math.abs(next.bbox.x - curr.bbox.x)
    const verticalDist = Math.abs(next.bbox.y - curr.bbox.y)

    if (verticalDist > horizontalDist) {
      verticalCount++
    } else {
      horizontalCount++
    }
  }

  return verticalCount > horizontalCount
}

/**
 * Group word-level text blocks into speech bubbles using spatial clustering
 */
function groupTextBlocksIntoSpeechBubbles(blocks: OCRResult[]): OCRResult[] {
  if (blocks.length === 0) {
    return []
  }

  // Detect text orientation
  const isVertical = isVerticalText(blocks)
  console.log(`Text orientation: ${isVertical ? 'vertical' : 'horizontal'}`)

  // Sort blocks based on text direction
  const sorted = [...blocks].sort((a, b) => {
    if (isVertical) {
      // Vertical text: right to left, top to bottom
      const horizontalDiff = b.bbox.x - a.bbox.x // Right to left
      if (Math.abs(horizontalDiff) > 50) {
        return horizontalDiff
      }
      return a.bbox.y - b.bbox.y // Top to bottom
    } else {
      // Horizontal text: top to bottom, left to right
      const verticalDiff = a.bbox.y - b.bbox.y
      if (Math.abs(verticalDiff) > 20) {
        return verticalDiff
      }
      return a.bbox.x - b.bbox.x
    }
  })

  // Group blocks into speech bubbles based on proximity
  const bubbles: OCRResult[][] = []
  let currentBubble: OCRResult[] = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const curr = sorted[i]
    const prev = sorted[i - 1]

    // Calculate distance between blocks
    const horizontalDist = Math.abs(curr.bbox.x - prev.bbox.x)
    const verticalDist = Math.abs(curr.bbox.y - prev.bbox.y)

    // Determine if blocks belong to same bubble
    const maxDistance = isVertical ? prev.bbox.width * 1.5 : prev.bbox.height * 1.5
    const distance = isVertical ? horizontalDist : verticalDist

    if (distance < maxDistance) {
      currentBubble.push(curr)
    } else {
      bubbles.push(currentBubble)
      currentBubble = [curr]
    }
  }

  if (currentBubble.length > 0) {
    bubbles.push(currentBubble)
  }

  // Merge each bubble into a single text block
  const result = bubbles.map((bubble) => mergeBlocks(bubble))

  console.log(`Grouped ${blocks.length} blocks into ${result.length} bubbles`)
  return result
}

/**
 * Merge multiple blocks into one line
 */
function mergeBlocks(blocks: OCRResult[]): OCRResult {
  const text = blocks.map((b) => b.text).join(' ')

  const xs = blocks.map((b) => b.bbox.x)
  const ys = blocks.map((b) => b.bbox.y)
  const x1s = blocks.map((b) => b.bbox.x + b.bbox.width)
  const y1s = blocks.map((b) => b.bbox.y + b.bbox.height)

  const x = Math.min(...xs)
  const y = Math.min(...ys)
  const width = Math.max(...x1s) - x
  const height = Math.max(...y1s) - y

  const avgConfidence = blocks.reduce((sum, b) => sum + b.confidence, 0) / blocks.length

  return {
    text: text.trim(),
    bbox: { x, y, width, height },
    confidence: avgConfidence,
  }
}
