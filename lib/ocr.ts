import Tesseract from 'tesseract.js'

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
      throw new Error('Google Vision OCR not implemented yet')
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
