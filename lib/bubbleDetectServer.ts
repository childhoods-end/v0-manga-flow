// Server-side bubble detection utilities
// Uses text block clustering to approximate speech bubble boundaries

import type { BoundingBox } from './database.types'

export interface Bubble {
  id: string
  bbox: BoundingBox
  score: number
  textBlockIds: string[]
}

/**
 * Group nearby text blocks into speech bubbles
 * This is a simplified heuristic approach for server-side processing
 */
export function groupTextBlocksIntoBubbles(
  textBlocks: Array<{ id: string; bbox: BoundingBox }>
): Bubble[] {
  if (textBlocks.length === 0) return []

  const bubbles: Bubble[] = []
  const used = new Set<string>()

  // Sort text blocks by position (top to bottom, left to right)
  const sorted = [...textBlocks].sort((a, b) => {
    const yDiff = a.bbox.y - b.bbox.y
    if (Math.abs(yDiff) > 20) return yDiff
    return a.bbox.x - b.bbox.x
  })

  for (const block of sorted) {
    if (used.has(block.id)) continue

    // Start a new bubble with this block
    const nearbyBlocks = [block]
    used.add(block.id)

    // Find nearby text blocks that likely belong to the same bubble
    for (const otherBlock of sorted) {
      if (used.has(otherBlock.id)) continue

      // Check if blocks are close enough to be in the same bubble
      const distance = getBlockDistance(block.bbox, otherBlock.bbox)
      const avgSize = (block.bbox.width + block.bbox.height + otherBlock.bbox.width + otherBlock.bbox.height) / 4

      // If blocks are within ~1.5x their average size, consider them in the same bubble
      if (distance < avgSize * 1.5) {
        nearbyBlocks.push(otherBlock)
        used.add(otherBlock.id)
      }
    }

    // Create bubble bounding box that encompasses all text blocks
    const bubbleBbox = createBubbleBoundingBox(nearbyBlocks.map(b => b.bbox))

    bubbles.push({
      id: `bubble-${bubbles.length}`,
      bbox: bubbleBbox,
      score: 0.8, // Default confidence score
      textBlockIds: nearbyBlocks.map(b => b.id)
    })
  }

  return bubbles
}

/**
 * Calculate distance between two bounding boxes
 */
function getBlockDistance(bbox1: BoundingBox, bbox2: BoundingBox): number {
  const center1 = {
    x: bbox1.x + bbox1.width / 2,
    y: bbox1.y + bbox1.height / 2
  }
  const center2 = {
    x: bbox2.x + bbox2.width / 2,
    y: bbox2.y + bbox2.height / 2
  }

  return Math.sqrt(
    Math.pow(center1.x - center2.x, 2) + Math.pow(center1.y - center2.y, 2)
  )
}

/**
 * Create a bounding box that encompasses all given bounding boxes
 * Adds padding to approximate the bubble border
 */
function createBubbleBoundingBox(bboxes: BoundingBox[]): BoundingBox {
  if (bboxes.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }

  const minX = Math.min(...bboxes.map(b => b.x))
  const minY = Math.min(...bboxes.map(b => b.y))
  const maxX = Math.max(...bboxes.map(b => b.x + b.width))
  const maxY = Math.max(...bboxes.map(b => b.y + b.height))

  // Add padding to approximate bubble borders (20% on each side)
  const paddingX = (maxX - minX) * 0.2
  const paddingY = (maxY - minY) * 0.2

  return {
    x: Math.max(0, minX - paddingX / 2),
    y: Math.max(0, minY - paddingY / 2),
    width: maxX - minX + paddingX,
    height: maxY - minY + paddingY
  }
}

/**
 * Find which bubble contains a given text block
 */
export function findBubbleForTextBlock(
  textBlockBbox: BoundingBox,
  bubbles: Bubble[]
): Bubble | null {
  for (const bubble of bubbles) {
    // Check if text block center is inside bubble bbox
    const textCenterX = textBlockBbox.x + textBlockBbox.width / 2
    const textCenterY = textBlockBbox.y + textBlockBbox.height / 2

    if (
      textCenterX >= bubble.bbox.x &&
      textCenterX <= bubble.bbox.x + bubble.bbox.width &&
      textCenterY >= bubble.bbox.y &&
      textCenterY <= bubble.bbox.y + bubble.bbox.height
    ) {
      return bubble
    }
  }

  return null
}
