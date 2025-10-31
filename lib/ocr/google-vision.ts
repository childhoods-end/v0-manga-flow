import type { OCRProvider, OCRResult, OCROptions } from './index'
import logger from '@/lib/logger'

/**
 * Google Vision OCR Provider (optional)
 * Requires GOOGLE_VISION_API_KEY environment variable
 */
export const googleVisionProvider: OCRProvider = {
  name: 'google-vision',

  async recognize(imageBuffer: Buffer, options?: OCROptions): Promise<OCRResult[]> {
    const apiKey = process.env.GOOGLE_VISION_API_KEY

    if (!apiKey) {
      throw new Error('GOOGLE_VISION_API_KEY not configured')
    }

    try {
      const base64Image = imageBuffer.toString('base64')

      const response = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [
              {
                image: { content: base64Image },
                features: [{ type: 'TEXT_DETECTION' }],
                imageContext: {
                  languageHints: [options?.language || 'ja'],
                },
              },
            ],
          }),
        }
      )

      if (!response.ok) {
        throw new Error(`Google Vision API error: ${response.statusText}`)
      }

      const data = await response.json()
      const annotations = data.responses[0]?.textAnnotations || []

      // Skip first annotation (full text), process individual words
      const results: OCRResult[] = annotations.slice(1).map((annotation: any) => {
        const vertices = annotation.boundingPoly.vertices
        const x = Math.min(...vertices.map((v: any) => v.x || 0))
        const y = Math.min(...vertices.map((v: any) => v.y || 0))
        const maxX = Math.max(...vertices.map((v: any) => v.x || 0))
        const maxY = Math.max(...vertices.map((v: any) => v.y || 0))

        const width = maxX - x
        const height = maxY - y
        const text = annotation.description

        // Detect orientation
        const orientation = height > width * 1.5 ? 'vertical' as const : 'horizontal' as const

        // Note: fontSize is now calculated based on speech bubble, not here
        return {
          text,
          confidence: annotation.confidence || 0.9,
          bbox: {
            x,
            y,
            width,
            height,
            rotation: 0,
          },
          orientation
        }
      })

      logger.info({ blockCount: results.length }, 'Google Vision OCR completed')

      return results
    } catch (error) {
      logger.error({ error }, 'Google Vision OCR failed')
      throw error
    }
  },
}
