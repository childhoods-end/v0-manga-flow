/**
 * Example usage of loadOpenCV
 *
 * This file demonstrates how to use the OpenCV.js loader
 * in a browser-side React component or client-side script
 */

import { loadOpenCV } from './loadOpenCV'

/**
 * Example: Convert image to grayscale
 */
export async function convertToGrayscale(
  imageElement: HTMLImageElement,
  outputCanvas: HTMLCanvasElement
): Promise<void> {
  // Load OpenCV.js (will reuse if already loaded)
  const cv = await loadOpenCV()

  // Read image into OpenCV Mat
  const src = cv.imread(imageElement)
  const dst = new cv.Mat()

  try {
    // Convert to grayscale
    cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY)

    // Display result
    cv.imshow(outputCanvas, dst)
  } finally {
    // Clean up memory
    src.delete()
    dst.delete()
  }
}

/**
 * Example: Detect edges using Canny
 */
export async function detectEdges(
  imageElement: HTMLImageElement,
  outputCanvas: HTMLCanvasElement,
  threshold1: number = 50,
  threshold2: number = 150
): Promise<void> {
  const cv = await loadOpenCV()

  const src = cv.imread(imageElement)
  const gray = new cv.Mat()
  const edges = new cv.Mat()

  try {
    // Convert to grayscale
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)

    // Apply Canny edge detection
    cv.Canny(gray, edges, threshold1, threshold2)

    // Display result
    cv.imshow(outputCanvas, edges)
  } finally {
    src.delete()
    gray.delete()
    edges.delete()
  }
}

/**
 * Example: Find and draw contours
 */
export async function findContours(
  imageElement: HTMLImageElement,
  outputCanvas: HTMLCanvasElement
): Promise<number> {
  const cv = await loadOpenCV()

  const src = cv.imread(imageElement)
  const gray = new cv.Mat()
  const binary = new cv.Mat()
  const contours = new cv.MatVector()
  const hierarchy = new cv.Mat()

  try {
    // Convert to grayscale
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)

    // Apply threshold
    cv.threshold(gray, binary, 127, 255, cv.THRESH_BINARY)

    // Find contours
    cv.findContours(
      binary,
      contours,
      hierarchy,
      cv.RETR_EXTERNAL,
      cv.CHAIN_APPROX_SIMPLE
    )

    // Draw contours
    const color = new cv.Scalar(255, 0, 0, 255) // Red
    cv.drawContours(src, contours, -1, color, 2)

    // Display result
    cv.imshow(outputCanvas, src)

    return contours.size()
  } finally {
    src.delete()
    gray.delete()
    binary.delete()
    contours.delete()
    hierarchy.delete()
  }
}

/**
 * Example: Apply blur effect
 */
export async function applyBlur(
  imageElement: HTMLImageElement,
  outputCanvas: HTMLCanvasElement,
  kernelSize: number = 5,
  sigma: number = 0
): Promise<void> {
  const cv = await loadOpenCV()

  const src = cv.imread(imageElement)
  const dst = new cv.Mat()

  try {
    const ksize = new cv.Size(kernelSize, kernelSize)
    cv.GaussianBlur(src, dst, ksize, sigma, sigma)

    cv.imshow(outputCanvas, dst)
  } finally {
    src.delete()
    dst.delete()
  }
}
