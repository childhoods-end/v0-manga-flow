'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { X, Save, RotateCcw, Trash2, AlignLeft, AlignVerticalJustifyCenter } from 'lucide-react'

interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

interface TextBlock {
  id: string
  bbox: BoundingBox
  ocr_text: string | null
  translated_text: string | null
  font_size: number
  confidence: number
  is_vertical: boolean
  bubble_id: string | null
}

interface SpeechBubble {
  id: string
  bbox: BoundingBox
  score: number
}

interface TextBlockEditorProps {
  pageId: string
  imageUrl: string
  textBlocks: TextBlock[]
  speechBubbles?: SpeechBubble[]
  onSave: (blockId: string, updates: Partial<TextBlock>) => Promise<void>
  onDelete: (blockId: string) => Promise<void>
  onClose: () => void
}

export function TextBlockEditor({
  pageId,
  imageUrl,
  textBlocks,
  speechBubbles = [],
  onSave,
  onDelete,
  onClose,
}: TextBlockEditorProps) {
  const [selectedBlock, setSelectedBlock] = useState<TextBlock | null>(null)
  const [selectedBlocks, setSelectedBlocks] = useState<Set<string>>(new Set())
  const [localTextBlocks, setLocalTextBlocks] = useState<TextBlock[]>(textBlocks)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [saving, setSaving] = useState(false)
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)
  const [isSelectionDragging, setIsSelectionDragging] = useState(false)
  const [selectionRect, setSelectionRect] = useState<{x: number, y: number, width: number, height: number} | null>(null)
  const [isSpacePressed, setIsSpacePressed] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })

  // Sync textBlocks prop to local state
  useEffect(() => {
    setLocalTextBlocks(textBlocks)
  }, [textBlocks])

  // Handle spacebar for panning mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault()
        setIsSpacePressed(true)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        setIsSpacePressed(false)
        setIsPanning(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const hasMouseMoved = useRef(false) // Track if mouse actually moved during interaction
  const [scale, setScale] = useState(1)
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })

  // Find the speech bubble for a text block
  function findBubbleForBlock(blockId: string): SpeechBubble | null {
    const block = localTextBlocks.find(b => b.id === blockId)
    if (!block || !block.bubble_id) return null
    return speechBubbles.find(b => b.id === block.bubble_id) || null
  }

  // Calculate font size based on bubble or text bbox
  // Use conservative coefficients to prevent text overflow
  // This logic must match the backend calculation in worker/route.ts
  function estimateFontSize(bbox: BoundingBox, textLength: number, isVertical: boolean = false, blockId?: string): number {
    // Try to find the speech bubble for this text block
    let bubble: SpeechBubble | null = null
    if (blockId) {
      bubble = findBubbleForBlock(blockId)
    }

    let fontSize: number

    if (bubble) {
      // Use actual detected bubble dimensions
      if (isVertical) {
        // For vertical text: width determines character size
        fontSize = Math.round(bubble.bbox.width * 0.45)
      } else {
        // For horizontal text: height determines character size
        fontSize = Math.round(bubble.bbox.height * 0.40)
      }
    } else {
      // Fallback: use text bbox
      if (isVertical) {
        fontSize = Math.round(bbox.width * 0.60)
      } else {
        fontSize = Math.round(bbox.height * 0.50)
      }
    }

    // Clamp font size to reasonable range (increased minimum to 10)
    return Math.max(10, Math.min(fontSize, 100))
  }

  // Load image and draw on canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      // Calculate scale to fit container
      const containerWidth = containerRef.current?.clientWidth || 800
      const maxWidth = Math.min(containerWidth - 40, 1200)
      const scaleX = maxWidth / img.width

      setScale(scaleX)
      setImageSize({ width: img.width, height: img.height })

      canvas.width = img.width * scaleX
      canvas.height = img.height * scaleX

      console.log('[Editor] Loading image:', imageUrl)
      console.log('[Editor] Image dimensions:', img.width, 'x', img.height)
      console.log('[Editor] Text blocks count:', localTextBlocks.length)

      drawCanvas(img, scaleX)
    }
    img.src = imageUrl
  }, [imageUrl, localTextBlocks, selectedBlock, selectedBlocks, selectionRect, panOffset])

  function drawCanvas(img: HTMLImageElement, currentScale: number) {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')!

    // Clear and draw image with pan offset
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.translate(panOffset.x * currentScale, panOffset.y * currentScale)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    // Draw all text blocks
    localTextBlocks.forEach((block) => {
      const isSelected = selectedBlock?.id === block.id
      const isMultiSelected = selectedBlocks.has(block.id)
      const bbox = block.bbox
      const displayText = block.translated_text || ''
      const isVertical = block.is_vertical || false
      // Always use stored font_size (calculated from bubble)
      // Only estimate if font_size is missing or invalid
      const fontSize = block.font_size && block.font_size > 0
        ? block.font_size
        : estimateFontSize(bbox, displayText.length, isVertical, block.id)

      // Scale bbox to canvas size
      const scaledBbox = {
        x: bbox.x * currentScale,
        y: bbox.y * currentScale,
        width: bbox.width * currentScale,
        height: bbox.height * currentScale,
      }

      // Always draw white background (mask) to cover original text
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(scaledBbox.x, scaledBbox.y, scaledBbox.width, scaledBbox.height)

      // Draw text if available
      if (displayText) {
        const scaledFontSize = fontSize * currentScale
        ctx.font = `${scaledFontSize}px "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "SimHei", Arial, sans-serif`
        ctx.fillStyle = '#000000'

        if (isVertical) {
          // Vertical text rendering (top to bottom)
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'

          const chars = displayText.split('')
          const charHeight = scaledFontSize * 1.1
          const totalHeight = chars.length * charHeight
          const startY = scaledBbox.y + (scaledBbox.height - totalHeight) / 2 + charHeight / 2
          const centerX = scaledBbox.x + scaledBbox.width / 2

          chars.forEach((char, i) => {
            const y = startY + i * charHeight
            ctx.fillText(char, centerX, y)
          })
        } else {
          // Horizontal text rendering
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'

          // Simple text wrapping
          const maxWidth = scaledBbox.width * 0.95
          const words = displayText.split('')
          const lines: string[] = []
          let currentLine = ''

          for (const char of words) {
            const testLine = currentLine + char
            const metrics = ctx.measureText(testLine)
            if (metrics.width > maxWidth && currentLine.length > 0) {
              lines.push(currentLine)
              currentLine = char
            } else {
              currentLine = testLine
            }
          }
          if (currentLine) lines.push(currentLine)

          // Draw lines centered
          const lineHeight = scaledFontSize * 1.2
          const totalHeight = lines.length * lineHeight
          const startY = scaledBbox.y + (scaledBbox.height - totalHeight) / 2 + lineHeight / 2

          lines.forEach((line, i) => {
            const y = startY + i * lineHeight
            ctx.fillText(line, scaledBbox.x + scaledBbox.width / 2, y)
          })
        }
      }

      // Draw bounding box
      ctx.strokeStyle = isSelected ? '#3b82f6' : isMultiSelected ? '#10b981' : '#ef4444'
      ctx.lineWidth = isSelected || isMultiSelected ? 3 : 2
      ctx.strokeRect(scaledBbox.x, scaledBbox.y, scaledBbox.width, scaledBbox.height)

      // Draw resize handle for selected block (diagonal arrows)
      if (isSelected) {
        const handleSize = 16
        const x = scaledBbox.x + scaledBbox.width - handleSize / 2
        const y = scaledBbox.y + scaledBbox.height - handleSize / 2

        // Draw diagonal resize icon (↖ ↘)
        ctx.strokeStyle = '#22c55e'
        ctx.fillStyle = '#22c55e'
        ctx.lineWidth = 3

        // Draw arrow lines
        const arrowSize = handleSize * 0.6

        // Top-left arrow (↖)
        ctx.beginPath()
        ctx.moveTo(x - arrowSize/2, y - arrowSize/2)
        ctx.lineTo(x + arrowSize/2, y + arrowSize/2)
        ctx.stroke()

        // Arrow head for top-left
        ctx.beginPath()
        ctx.moveTo(x - arrowSize/2, y - arrowSize/2)
        ctx.lineTo(x - arrowSize/2 + 3, y - arrowSize/2)
        ctx.lineTo(x - arrowSize/2, y - arrowSize/2 + 3)
        ctx.closePath()
        ctx.fill()

        // Arrow head for bottom-right
        ctx.beginPath()
        ctx.moveTo(x + arrowSize/2, y + arrowSize/2)
        ctx.lineTo(x + arrowSize/2 - 3, y + arrowSize/2)
        ctx.lineTo(x + arrowSize/2, y + arrowSize/2 - 3)
        ctx.closePath()
        ctx.fill()
      }
    })

    // Draw selection rectangle if dragging
    if (selectionRect) {
      ctx.strokeStyle = '#3b82f6'
      ctx.fillStyle = 'rgba(59, 130, 246, 0.1)'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])

      const scaledRect = {
        x: selectionRect.x * currentScale,
        y: selectionRect.y * currentScale,
        width: selectionRect.width * currentScale,
        height: selectionRect.height * currentScale
      }

      ctx.fillRect(scaledRect.x, scaledRect.y, scaledRect.width, scaledRect.height)
      ctx.strokeRect(scaledRect.x, scaledRect.y, scaledRect.width, scaledRect.height)
      ctx.setLineDash([])
    }

    ctx.restore()
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    // Skip if mouse actually moved (was a drag, not a click)
    if (hasMouseMoved.current) {
      console.log('[Click] Skipped - mouse moved during interaction')
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / scale - panOffset.x
    const y = (e.clientY - rect.top) / scale - panOffset.y

    // Find clicked text block
    for (const block of localTextBlocks) {
      const bbox = block.bbox
      if (
        x >= bbox.x &&
        x <= bbox.x + bbox.width &&
        y >= bbox.y &&
        y <= bbox.y + bbox.height
      ) {
        // Multi-select mode (Ctrl/Cmd + Click)
        if (isMultiSelectMode || e.ctrlKey || e.metaKey) {
          setSelectedBlocks(prev => {
            const newSet = new Set(prev)
            if (newSet.has(block.id)) {
              newSet.delete(block.id)
            } else {
              newSet.add(block.id)
            }
            return newSet
          })
          setSelectedBlock(null)
          return
        }

        // Regular single select
        console.log('[Click] Selected block:', block.id)
        // If font_size is 0 or missing, estimate from bubble/bbox
        if (!block.font_size || block.font_size === 0) {
          const initialFontSize = estimateFontSize(block.bbox, (block.translated_text || '').length, block.is_vertical || false, block.id)
          updateLocalBlock(block.id, { font_size: initialFontSize })
        }
        setSelectedBlock(block)
        setSelectedBlocks(new Set())
        return
      }
    }

    // Click outside - deselect
    setSelectedBlock(null)
    if (!isMultiSelectMode) {
      setSelectedBlocks(new Set())
    }
  }

  function handleCanvasMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return

    // Reset movement tracking
    hasMouseMoved.current = false

    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / scale - panOffset.x
    const y = (e.clientY - rect.top) / scale - panOffset.y

    // If spacebar is pressed, start panning
    if (isSpacePressed) {
      e.preventDefault() // Prevent page scroll
      setIsPanning(true)
      setPanStart({ x: e.clientX, y: e.clientY })
      return
    }

    // Check if clicking on any block
    let clickedBlock: TextBlock | null = null
    for (const block of localTextBlocks) {
      const bbox = block.bbox
      if (x >= bbox.x && x <= bbox.x + bbox.width && y >= bbox.y && y <= bbox.y + bbox.height) {
        clickedBlock = block
        break
      }
    }

    // If clicking on empty area, start drag selection (works in both modes)
    if (!clickedBlock) {
      e.preventDefault() // Prevent page scroll during drag selection
      setIsSelectionDragging(true)
      setDragStart({ x, y })
      setSelectionRect({ x, y, width: 0, height: 0 })
      setSelectedBlock(null) // Deselect current block when starting drag selection
      return
    }

    // If clicked on a block in multi-select mode, toggle selection
    if (isMultiSelectMode || e.ctrlKey || e.metaKey) {
      setSelectedBlocks(prev => {
        const newSet = new Set(prev)
        if (newSet.has(clickedBlock.id)) {
          newSet.delete(clickedBlock.id)
        } else {
          newSet.add(clickedBlock.id)
        }
        return newSet
      })
      setSelectedBlock(null)
      return
    }

    // Regular single selection and dragging logic
    if (!selectedBlock || selectedBlock.id !== clickedBlock.id) {
      // Selecting a different block
      if (!clickedBlock.font_size || clickedBlock.font_size === 0) {
        const initialFontSize = estimateFontSize(clickedBlock.bbox, (clickedBlock.translated_text || '').length, clickedBlock.is_vertical || false, clickedBlock.id)
        updateLocalBlock(clickedBlock.id, { font_size: initialFontSize })
      }
      setSelectedBlock(clickedBlock)
      setSelectedBlocks(new Set())
      return
    }

    // If already selected, handle dragging or resizing
    const bbox = selectedBlock.bbox

    // Check if clicking resize handle (larger clickable area)
    const handleSize = 16 / scale
    if (
      x >= bbox.x + bbox.width - handleSize &&
      x <= bbox.x + bbox.width + handleSize/2 &&
      y >= bbox.y + bbox.height - handleSize &&
      y <= bbox.y + bbox.height + handleSize/2
    ) {
      setIsResizing(true)
      setDragStart({ x: e.clientX, y: e.clientY })
      return
    }

    // Check if clicking inside bbox for dragging
    if (
      x >= bbox.x &&
      x <= bbox.x + bbox.width &&
      y >= bbox.y &&
      y <= bbox.y + bbox.height
    ) {
      setIsDragging(true)
      setDragStart({ x: e.clientX - bbox.x * scale, y: e.clientY - bbox.y * scale })
    }
  }

  function handleCanvasMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / scale - panOffset.x
    const y = (e.clientY - rect.top) / scale - panOffset.y

    // Handle panning
    if (isPanning) {
      hasMouseMoved.current = true // Mark as moved
      const dx = (e.clientX - panStart.x) / scale
      const dy = (e.clientY - panStart.y) / scale
      setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }))
      setPanStart({ x: e.clientX, y: e.clientY })
      return
    }

    // Handle selection rectangle dragging
    if (isSelectionDragging) {
      hasMouseMoved.current = true // Mark as moved
      if (!dragStart) return

      const width = x - dragStart.x
      const height = y - dragStart.y

      setSelectionRect({
        x: width >= 0 ? dragStart.x : x,
        y: height >= 0 ? dragStart.y : y,
        width: Math.abs(width),
        height: Math.abs(height)
      })
      return
    }

    if (!selectedBlock) return

    if (isDragging) {
      hasMouseMoved.current = true // Mark as moved
      const newX = (e.clientX - dragStart.x) / scale
      const newY = (e.clientY - dragStart.y) / scale

      const newBbox = {
        ...selectedBlock.bbox,
        x: Math.max(0, Math.min(newX, imageSize.width - selectedBlock.bbox.width)),
        y: Math.max(0, Math.min(newY, imageSize.height - selectedBlock.bbox.height)),
      }

      updateLocalBlock(selectedBlock.id, { bbox: newBbox })
    } else if (isResizing) {
      hasMouseMoved.current = true // Mark as moved
      const deltaX = (e.clientX - dragStart.x) / scale
      const deltaY = (e.clientY - dragStart.y) / scale

      const newBbox = {
        ...selectedBlock.bbox,
        width: Math.max(20, selectedBlock.bbox.width + deltaX),
        height: Math.max(20, selectedBlock.bbox.height + deltaY),
      }

      updateLocalBlock(selectedBlock.id, { bbox: newBbox })
      setDragStart({ x: e.clientX, y: e.clientY })
    }
  }

  function updateLocalBlock(blockId: string, updates: Partial<TextBlock>) {
    setLocalTextBlocks(prev =>
      prev.map(block =>
        block.id === blockId ? { ...block, ...updates } : block
      )
    )
    // Also update selectedBlock
    setSelectedBlock(prev =>
      prev && prev.id === blockId ? { ...prev, ...updates } : prev
    )
  }

  function handleCanvasMouseUp() {
    console.log('[MouseUp] State before reset:', {
      isDragging,
      isResizing,
      isSelectionDragging,
      isPanning,
      hasSelectionRect: !!selectionRect,
      hasMouseMoved: hasMouseMoved.current
    })

    // Handle selection rectangle completion
    if (isSelectionDragging) {
      if (selectionRect) {
        // Find all blocks that intersect with selection rectangle
        const selected = new Set<string>()

        for (const block of localTextBlocks) {
          const bbox = block.bbox
          // Check if rectangles intersect
          const intersects = !(
            bbox.x + bbox.width < selectionRect.x ||
            bbox.x > selectionRect.x + selectionRect.width ||
            bbox.y + bbox.height < selectionRect.y ||
            bbox.y > selectionRect.y + selectionRect.height
          )

          if (intersects) {
            selected.add(block.id)
          }
        }

        setSelectedBlocks(selected)
      }
      setSelectionRect(null)
    }

    // Always reset all drag/interaction states on mouse up
    setIsDragging(false)
    setIsResizing(false)
    setIsSelectionDragging(false)
    setIsPanning(false)
  }

  async function handleSave() {
    if (!selectedBlock) return

    setSaving(true)
    try {
      await onSave(selectedBlock.id, {
        translated_text: selectedBlock.translated_text,
        font_size: selectedBlock.font_size,
        bbox: selectedBlock.bbox,
        is_vertical: selectedBlock.is_vertical,
      })

      // Deselect block but keep editor open
      setSelectedBlock(null)
    } catch (error) {
      console.error('Failed to save:', error)
      alert('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  function handleReset() {
    if (!selectedBlock) return

    // Find original block from textBlocks prop
    const originalBlock = textBlocks.find(b => b.id === selectedBlock.id)
    if (!originalBlock) return

    // Reset local block to original values
    updateLocalBlock(selectedBlock.id, {
      translated_text: originalBlock.translated_text,
      font_size: originalBlock.font_size,
      bbox: originalBlock.bbox,
      is_vertical: originalBlock.is_vertical,
    })
  }

  async function handleDelete() {
    if (!selectedBlock) return

    setSaving(true)
    try {
      // Completely delete the text block
      await onDelete(selectedBlock.id)

      // Remove from local text blocks array
      setLocalTextBlocks(prev => prev.filter(b => b.id !== selectedBlock.id))

      // Deselect block but keep editor open
      setSelectedBlock(null)
    } catch (error) {
      console.error('Failed to delete:', error)
      alert('删除失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  async function handleBatchDelete() {
    if (selectedBlocks.size === 0) {
      alert('请选择要删除的文本框')
      return
    }

    setSaving(true)
    try {
      // Delete all selected blocks
      const deletePromises = Array.from(selectedBlocks).map(blockId => onDelete(blockId))
      await Promise.all(deletePromises)

      // Remove from local text blocks array
      setLocalTextBlocks(prev => prev.filter(b => !selectedBlocks.has(b.id)))

      // Clear selection but keep batch mode active
      setSelectedBlocks(new Set())
    } catch (error) {
      console.error('Failed to batch delete:', error)
      alert('批量删除失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  async function handleMergeBlocks() {
    if (selectedBlocks.size < 2) {
      alert('请选择至少2个文本框进行合并')
      return
    }

    setSaving(true)
    try {
      const blocksToMerge = localTextBlocks.filter(b => selectedBlocks.has(b.id))

      // Calculate merged bounding box (union of all boxes)
      const minX = Math.min(...blocksToMerge.map(b => b.bbox.x))
      const minY = Math.min(...blocksToMerge.map(b => b.bbox.y))
      const maxX = Math.max(...blocksToMerge.map(b => b.bbox.x + b.bbox.width))
      const maxY = Math.max(...blocksToMerge.map(b => b.bbox.y + b.bbox.height))

      const mergedBbox = {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
      }

      // Merge translated text (join with space or newline based on orientation)
      const sortedBlocks = [...blocksToMerge].sort((a, b) => {
        // Sort by position (top to bottom, left to right for horizontal text)
        const verticalDiff = a.bbox.y - b.bbox.y
        if (Math.abs(verticalDiff) > 20) {
          return verticalDiff
        }
        return a.bbox.x - b.bbox.x
      })

      const mergedText = sortedBlocks
        .map(b => b.translated_text || '')
        .filter(t => t.trim())
        .join('\n')

      const avgFontSize = Math.round(
        blocksToMerge.reduce((sum, b) => sum + (b.font_size || 16), 0) / blocksToMerge.length
      )

      // Keep the first block and update it with merged data
      const firstBlock = blocksToMerge[0]
      await onSave(firstBlock.id, {
        bbox: mergedBbox,
        translated_text: mergedText,
        font_size: avgFontSize,
        is_vertical: firstBlock.is_vertical
      })

      // Delete other blocks
      for (let i = 1; i < blocksToMerge.length; i++) {
        await onDelete(blocksToMerge[i].id)
      }

      // Update local state
      setLocalTextBlocks(prev => {
        const remaining = prev.filter(b => !selectedBlocks.has(b.id) || b.id === firstBlock.id)
        return remaining.map(b =>
          b.id === firstBlock.id
            ? { ...b, bbox: mergedBbox, translated_text: mergedText, font_size: avgFontSize }
            : b
        )
      })

      setSelectedBlocks(new Set())
      setSelectedBlock(null)
    } catch (error) {
      console.error('Failed to merge blocks:', error)
      alert('合并失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-7xl max-h-[90vh] flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between border-b">
          <CardTitle>编辑文本块</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-0">
          <div className="flex h-full">
            {/* Canvas area */}
            <div ref={containerRef} className="flex-1 overflow-auto p-4 bg-slate-50 dark:bg-slate-900 flex flex-col">
              {/* Canvas */}
              <div className="flex-1 overflow-auto">
                <div className="inline-block">
                  <canvas
                    ref={canvasRef}
                    onClick={handleCanvasClick}
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                    onMouseLeave={handleCanvasMouseUp}
                    className="border border-slate-300 dark:border-slate-700 cursor-crosshair"
                    style={{ cursor: isPanning ? 'grabbing' : isSpacePressed ? 'grab' : isDragging ? 'move' : isResizing ? 'nwse-resize' : isSelectionDragging ? 'crosshair' : 'default' }}
                  />
                </div>
              </div>

              {/* Instructions */}
              <div className="mt-4 text-sm text-slate-600 dark:text-slate-400 space-y-1">
                <p>💡 点击选择，拖动移动，拖右下角调整大小</p>
                <p>🎯 <strong>拖拽空白处圈选多个文本框</strong>，或Ctrl+点击多选</p>
                <p>⌨️ <strong>按住空格键可拖动移动图片</strong></p>
                {selectedBlocks.size > 0 && (
                  <p className="text-green-600 font-bold text-base mt-1">
                    ✓ 已选择 {selectedBlocks.size} 个文本框
                  </p>
                )}
              </div>
            </div>

            {/* Editor panel */}
            <div className="w-80 border-l p-4 overflow-auto">
              {/* Multi-select toolbar - always visible at top */}
              <div className="mb-4 pb-4 border-b space-y-2">
                <div className="text-xs text-slate-500 mb-2 p-2 bg-slate-50 dark:bg-slate-900 rounded">
                  💡 提示：按住空格键可拖动图片
                </div>
                <Button
                  variant={isMultiSelectMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setIsMultiSelectMode(!isMultiSelectMode)
                    if (!isMultiSelectMode) {
                      setSelectedBlock(null)
                    } else {
                      setSelectedBlocks(new Set())
                    }
                  }}
                  className="w-full"
                >
                  {isMultiSelectMode ? '✓ ' : ''}批量操作
                </Button>
                {isMultiSelectMode && selectedBlocks.size > 0 && (
                  <>
                    <div className="text-sm text-center text-slate-600 dark:text-slate-400 py-1">
                      已选择 {selectedBlocks.size} 个文本框
                    </div>
                    {selectedBlocks.size >= 2 && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleMergeBlocks}
                        disabled={saving}
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        🔗 合并 {selectedBlocks.size} 个文本框
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleBatchDelete}
                      disabled={saving}
                      className="w-full"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      删除 {selectedBlocks.size} 个文本框
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedBlocks(new Set())}
                      className="w-full"
                    >
                      清除选择
                    </Button>
                  </>
                )}
              </div>

              {selectedBlock ? (
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs text-slate-500">原文</Label>
                    <p className="text-sm bg-slate-100 dark:bg-slate-800 p-2 rounded mt-1">
                      {selectedBlock.ocr_text || '(无)'}
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="translated-text">译文</Label>
                    <textarea
                      id="translated-text"
                      value={selectedBlock.translated_text || ''}
                      onChange={(e) => {
                        const newText = e.target.value
                        // Keep the original font size, don't recalculate
                        updateLocalBlock(selectedBlock.id, {
                          translated_text: newText
                        })
                      }}
                      className="w-full min-h-[100px] p-2 border rounded mt-1 text-sm"
                      placeholder="输入译文..."
                    />
                  </div>

                  <div>
                    <Label htmlFor="font-size">字体大小: {selectedBlock.font_size}px</Label>
                    <Slider
                      id="font-size"
                      min={8}
                      max={120}
                      step={1}
                      value={[selectedBlock.font_size || 16]}
                      onValueChange={(value) => updateLocalBlock(selectedBlock.id, { font_size: value[0] })}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-slate-500 mb-2 block">文本方向</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={!selectedBlock.is_vertical ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => updateLocalBlock(selectedBlock.id, { is_vertical: false })}
                        className="flex-1"
                      >
                        <AlignLeft className="w-4 h-4 mr-1" />
                        横排
                      </Button>
                      <Button
                        type="button"
                        variant={selectedBlock.is_vertical ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => updateLocalBlock(selectedBlock.id, { is_vertical: true })}
                        className="flex-1"
                      >
                        <AlignVerticalJustifyCenter className="w-4 h-4 mr-1" />
                        竖排
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-slate-500">位置与尺寸</Label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <div>
                        <Label htmlFor="bbox-x" className="text-xs">X</Label>
                        <Input
                          id="bbox-x"
                          type="number"
                          value={Math.round(selectedBlock.bbox.x)}
                          onChange={(e) => updateLocalBlock(selectedBlock.id, { bbox: { ...selectedBlock.bbox, x: Number(e.target.value) } })}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div>
                        <Label htmlFor="bbox-y" className="text-xs">Y</Label>
                        <Input
                          id="bbox-y"
                          type="number"
                          value={Math.round(selectedBlock.bbox.y)}
                          onChange={(e) => updateLocalBlock(selectedBlock.id, { bbox: { ...selectedBlock.bbox, y: Number(e.target.value) } })}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div>
                        <Label htmlFor="bbox-width" className="text-xs">宽度</Label>
                        <Input
                          id="bbox-width"
                          type="number"
                          value={Math.round(selectedBlock.bbox.width)}
                          onChange={(e) => updateLocalBlock(selectedBlock.id, { bbox: { ...selectedBlock.bbox, width: Number(e.target.value) } })}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div>
                        <Label htmlFor="bbox-height" className="text-xs">高度</Label>
                        <Input
                          id="bbox-height"
                          type="number"
                          value={Math.round(selectedBlock.bbox.height)}
                          onChange={(e) => updateLocalBlock(selectedBlock.id, { bbox: { ...selectedBlock.bbox, height: Number(e.target.value) } })}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Button onClick={handleSave} disabled={saving} className="flex-1">
                        <Save className="w-4 h-4 mr-2" />
                        {saving ? '保存中...' : '保存'}
                      </Button>
                      <Button onClick={handleReset} variant="outline" size="sm">
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                    </div>
                    <Button
                      onClick={handleDelete}
                      disabled={saving}
                      variant="destructive"
                      className="w-full"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      {saving ? '删除中...' : '删除文本块'}
                    </Button>
                  </div>

                  <div className="text-xs text-slate-500 space-y-1">
                    <p>置信度: {Math.round(selectedBlock.confidence * 100)}%</p>
                    <p>ID: {selectedBlock.id.slice(0, 8)}...</p>
                  </div>
                </div>
              ) : (
                <div className="text-center text-slate-500 py-12">
                  <p className="text-sm">点击画布上的文本框</p>
                  <p className="text-sm">开始编辑</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
