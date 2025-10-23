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
}

interface TextBlockEditorProps {
  pageId: string
  imageUrl: string
  textBlocks: TextBlock[]
  onSave: (blockId: string, updates: Partial<TextBlock>) => Promise<void>
  onDelete: (blockId: string) => Promise<void>
  onClose: () => void
}

export function TextBlockEditor({
  pageId,
  imageUrl,
  textBlocks,
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

  // Sync textBlocks prop to local state
  useEffect(() => {
    setLocalTextBlocks(textBlocks)
  }, [textBlocks])

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })

  // Calculate initial font size based on bbox dimensions
  function calculateInitialFontSize(text: string, bbox: BoundingBox): number {
    if (!text) return 16
    const charCount = text.length
    const availableWidth = bbox.width * 0.85
    const availableHeight = bbox.height * 0.85

    // Very conservative initial estimate - ensure text fits well within bubble
    let fontSize = Math.sqrt((bbox.width * bbox.height) / charCount) * 1.3

    // Clamp to reasonable range
    fontSize = Math.max(8, Math.min(fontSize, 45))

    return Math.floor(fontSize)
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
  }, [imageUrl, localTextBlocks, selectedBlock])

  function drawCanvas(img: HTMLImageElement, currentScale: number) {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')!

    // Clear and draw image
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    // Draw all text blocks
    localTextBlocks.forEach((block) => {
      const isSelected = selectedBlock?.id === block.id
      const isMultiSelected = selectedBlocks.has(block.id)
      const bbox = block.bbox
      const displayText = block.translated_text || ''
      // Use stored font_size if valid, otherwise calculate from bbox and text
      const fontSize = block.font_size && block.font_size > 0
        ? block.font_size
        : calculateInitialFontSize(displayText, bbox)
      const isVertical = block.is_vertical || false

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
        ctx.strokeStyle = '#3b82f6'
        ctx.fillStyle = '#3b82f6'
        ctx.lineWidth = 2

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
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (isDragging || isResizing) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / scale
    const y = (e.clientY - rect.top) / scale

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
        // If font_size is 0 or missing, calculate initial value
        if (!block.font_size || block.font_size === 0) {
          const initialFontSize = calculateInitialFontSize(block.translated_text || '', block.bbox)
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

    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / scale
    const y = (e.clientY - rect.top) / scale

    // In multi-select mode, start selection drag if clicking on empty area
    if (isMultiSelectMode) {
      // Check if clicking on any block
      let clickedOnBlock = false
      for (const block of localTextBlocks) {
        const bbox = block.bbox
        if (x >= bbox.x && x <= bbox.x + bbox.width && y >= bbox.y && y <= bbox.y + bbox.height) {
          clickedOnBlock = true
          break
        }
      }

      if (!clickedOnBlock) {
        setIsSelectionDragging(true)
        setDragStart({ x, y })
        setSelectionRect({ x, y, width: 0, height: 0 })
        return
      }
    }

    if (!selectedBlock) return

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
    const x = (e.clientX - rect.left) / scale
    const y = (e.clientY - rect.top) / scale

    // Handle selection rectangle dragging
    if (isSelectionDragging && selectionRect) {
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
      const newX = (e.clientX - dragStart.x) / scale
      const newY = (e.clientY - dragStart.y) / scale

      const newBbox = {
        ...selectedBlock.bbox,
        x: Math.max(0, Math.min(newX, imageSize.width - selectedBlock.bbox.width)),
        y: Math.max(0, Math.min(newY, imageSize.height - selectedBlock.bbox.height)),
      }

      updateLocalBlock(selectedBlock.id, { bbox: newBbox })
    } else if (isResizing) {
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
    // Handle selection rectangle completion
    if (isSelectionDragging && selectionRect) {
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
      setIsSelectionDragging(false)
      setSelectionRect(null)
      return
    }

    setIsDragging(false)
    setIsResizing(false)
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

    if (!confirm('确定要完全删除此文本块吗？删除后该区域将只显示原图，且无法编辑。')) {
      return
    }

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
            <div ref={containerRef} className="flex-1 overflow-auto p-4 bg-slate-50 dark:bg-slate-900">
              <div className="inline-block">
                <canvas
                  ref={canvasRef}
                  onClick={handleCanvasClick}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseUp}
                  className="border border-slate-300 dark:border-slate-700 cursor-crosshair"
                  style={{ cursor: isDragging ? 'move' : isResizing ? 'nwse-resize' : 'crosshair' }}
                />
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex gap-2">
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
                  >
                    {isMultiSelectMode ? '✓ 多选模式' : '多选模式'}
                  </Button>
                  {selectedBlocks.size >= 2 && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleMergeBlocks}
                      disabled={saving}
                    >
                      合并 {selectedBlocks.size} 个文本框
                    </Button>
                  )}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  <p>💡 点击选择，拖动移动，拖右下角调整大小</p>
                  <p>{isMultiSelectMode ? '🎯 多选模式：拖拽圈选或Ctrl+点击' : 'Ctrl+点击多选'}</p>
                  <p>已翻译: {localTextBlocks.filter(b => b.translated_text).length} / {localTextBlocks.length}</p>
                  {selectedBlocks.size > 0 && (
                    <p className="text-green-600">✓ 已选择: {selectedBlocks.size} 个文本框</p>
                  )}
                </div>
              </div>
            </div>

            {/* Editor panel */}
            <div className="w-80 border-l p-4 overflow-auto">
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
                      onChange={(e) => updateLocalBlock(selectedBlock.id, { translated_text: e.target.value })}
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
