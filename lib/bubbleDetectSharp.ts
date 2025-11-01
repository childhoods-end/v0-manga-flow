// Server-side bubble detection using Sharp image processing
// Alternative to OpenCV for server environments

import sharp from 'sharp'
import type { BoundingBox } from './database.types'

export interface BubbleDetection {
  id: string
  bbox: BoundingBox
  score: number
  area: number
}

/**
 * Detect speech bubbles from image buffer using edge detection
 * This is a simplified approach using Sharp instead of OpenCV
 */
export async function detectBubblesFromBuffer(
  imageBuffer: Buffer
): Promise<BubbleDetection[]> {
  try {
    // Get image metadata
    const metadata = await sharp(imageBuffer).metadata()
    const width = metadata.width || 0
    const height = metadata.height || 0

    if (width === 0 || height === 0) {
      throw new Error('Invalid image dimensions')
    }

    // Convert to grayscale and detect edges
    const processedImage = await sharp(imageBuffer)
      .greyscale()
      .normalise() // Enhance contrast
      .blur(1) // Slight blur to reduce noise
      .toBuffer()

    // Use Canny-like edge detection by finding regions with high variance
    const edgeImage = await sharp(processedImage)
      .convolve({
        width: 3,
        height: 3,
        kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1] // Laplacian kernel for edge detection
      })
      .threshold(30) // Binarize
      .toBuffer({ resolveWithObject: true })

    // Get raw pixel data
    const { data, info } = await sharp(edgeImage.data)
      .raw()
      .toBuffer({ resolveWithObject: true })

    // Find connected components (bubbles)
    const bubbles = findConnectedRegions(data, info.width, info.height)

    // Filter and rank bubbles
    const filteredBubbles = bubbles
      .filter(bubble => {
        // Filter based on size and aspect ratio
        const area = bubble.bbox.width * bubble.bbox.height
        const aspectRatio = Math.max(bubble.bbox.width, bubble.bbox.height) /
                           Math.min(bubble.bbox.width, bubble.bbox.height)

        return (
          area > 2000 && // Minimum area
          area < (width * height * 0.5) && // Not too large (not whole image)
          aspectRatio < 3 && // Reasonable aspect ratio
          bubble.bbox.width > 30 && // Minimum dimensions
          bubble.bbox.height > 30
        )
      })
      .map((bubble, index) => ({
        ...bubble,
        id: `bubble-${index}`,
        score: calculateBubbleScore(bubble, width, height)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 50) // Limit to top 50 bubbles

    console.log(`Detected ${filteredBubbles.length} potential bubbles using Sharp`)
    return filteredBubbles
  } catch (error) {
    console.error('Bubble detection failed:', error)
    return []
  }
}

/**
 * Find connected regions in binary image data
 * Simplified flood-fill algorithm
 */
function findConnectedRegions(
  data: Buffer,
  width: number,
  height: number
): Array<{ bbox: BoundingBox; area: number }> {
  const visited = new Set<number>()
  const regions: Array<{ bbox: BoundingBox; area: number }> = []

  // Sample grid to reduce computation (check every 5th pixel)
  const step = 5

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const idx = y * width + x
      if (visited.has(idx) || data[idx] === 0) continue

      // Found a new region, do flood fill
      const region = floodFill(data, width, height, x, y, visited)
      if (region.area > 100) { // Minimum region size
        regions.push(region)
      }
    }
  }

  return regions
}

/**
 * Flood fill to find connected region
 */
function floodFill(
  data: Buffer,
  width: number,
  height: number,
  startX: number,
  startY: number,
  visited: Set<number>
): { bbox: BoundingBox; area: number } {
  const queue: Array<[number, number]> = [[startX, startY]]
  let minX = startX, maxX = startX
  let minY = startY, maxY = startY
  let area = 0

  // Limit flood fill to prevent infinite loops
  const maxIterations = 10000
  let iterations = 0

  while (queue.length > 0 && iterations < maxIterations) {
    iterations++
    const [x, y] = queue.shift()!
    const idx = y * width + x

    if (
      x < 0 || x >= width ||
      y < 0 || y >= height ||
      visited.has(idx) ||
      data[idx] === 0
    ) {
      continue
    }

    visited.add(idx)
    area++

    // Update bounds
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)

    // Add neighbors (4-connectivity to reduce computation)
    queue.push([x + 1, y])
    queue.push([x - 1, y])
    queue.push([x, y + 1])
    queue.push([x, y - 1])
  }

  return {
    bbox: {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1
    },
    area
  }
}

/**
 * Calculate bubble quality score
 */
function calculateBubbleScore(
  bubble: { bbox: BoundingBox; area: number },
  imageWidth: number,
  imageHeight: number
): number {
  const { width, height } = bubble.bbox
  const area = bubble.area

  // Prefer bubbles that are:
  // 1. Not too small or too large
  const sizeScore = Math.min(area / 5000, 1) * Math.max(1 - area / (imageWidth * imageHeight * 0.3), 0)

  // 2. Roughly square-ish (aspect ratio close to 1)
  const aspectRatio = Math.max(width, height) / Math.min(width, height)
  const aspectScore = Math.max(0, 1 - (aspectRatio - 1) / 2)

  // 3. Not at the edge of the image
  const centerX = bubble.bbox.x + width / 2
  const centerY = bubble.bbox.y + height / 2
  const edgeDistX = Math.min(centerX, imageWidth - centerX) / imageWidth
  const edgeDistY = Math.min(centerY, imageHeight - centerY) / imageHeight
  const positionScore = (edgeDistX + edgeDistY) / 2

  // Combined score
  return sizeScore * 0.4 + aspectScore * 0.4 + positionScore * 0.2
}

/**
 * Match text blocks to detected bubbles
 */
export function matchTextBlocksToBubbles(
  textBlocks: Array<{ id: string; bbox: BoundingBox }>,
  bubbles: BubbleDetection[]
): Map<string, BubbleDetection> {
  const matches = new Map<string, BubbleDetection>()

  for (const textBlock of textBlocks) {
    const textCenterX = textBlock.bbox.x + textBlock.bbox.width / 2
    const textCenterY = textBlock.bbox.y + textBlock.bbox.height / 2

    // Find bubble that contains this text block's center
    const matchingBubble = bubbles.find(bubble => {
      return (
        textCenterX >= bubble.bbox.x &&
        textCenterX <= bubble.bbox.x + bubble.bbox.width &&
        textCenterY >= bubble.bbox.y &&
        textCenterY <= bubble.bbox.y + bubble.bbox.height
      )
    })

    if (matchingBubble) {
      matches.set(textBlock.id, matchingBubble)
    }
  }

  return matches
}
