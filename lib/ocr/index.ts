import type { BoundingBox } from '@/lib/database.types'

export interface OCRResult {
  text: string
  confidence: number
  bbox: BoundingBox
  fontSize?: number  // Estimated font size from OCR
  orientation?: 'horizontal' | 'vertical'  // Text orientation
}

export interface OCRProvider {
  name: string
  recognize(imageBuffer: Buffer, options?: OCROptions): Promise<OCRResult[]>
}

export interface OCROptions {
  language?: string
  oem?: number // OCR Engine Mode
  psm?: number // Page Segmentation Mode
}

export async function performOCR(
  imageBuffer: Buffer,
  provider: string = 'tesseract',
  options?: OCROptions
): Promise<OCRResult[]> {
  const providerInstance = getOCRProvider(provider)
  return providerInstance.recognize(imageBuffer, options)
}

function getOCRProvider(providerName: string): OCRProvider {
  switch (providerName) {
    case 'tesseract':
      return require('./tesseract').tesseractProvider
    case 'google-vision':
      return require('./google-vision').googleVisionProvider
    default:
      throw new Error(`Unknown OCR provider: ${providerName}`)
  }
}
