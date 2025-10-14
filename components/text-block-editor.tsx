'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { X, Save, RotateCcw, Trash2 } from 'lucide-react'

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
}

interface TextBlockEditorProps {
  pageId: string
  imageUrl: string
  textBlocks: TextBlock[]
  onSave: (blockId: string, updates: Partial<TextBlock>) => Promise<void>
  onClose: () => void
}

export function TextBlockEditor({
  pageId,
  imageUrl,
  textBlocks,
  onSave,
  onClose,
}: TextBlockEditorProps) {
  const [selectedBlock, setSelectedBlock] = useState<TextBlock | null>(null)
  const [editedText, setEditedText] = useState('')
  const [editedFontSize, setEditedFontSize] = useState(16)
  const [editedBbox, setEditedBbox] = useState<BoundingBox | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [saving, setSaving] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })

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

      drawCanvas(img, scaleX)
    }
    img.src = imageUrl
  }, [imageUrl, textBlocks, selectedBlock, editedBbox, editedText, editedFontSize])

  function drawCanvas(img: HTMLImageElement, currentScale: number) {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')!

    // Clear and draw image
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    // Draw all text blocks
    textBlocks.forEach((block) => {
      const isSelected = selectedBlock?.id === block.id
      const bbox = isSelected && editedBbox ? editedBbox : block.bbox
      const displayText = isSelected && editedText ? editedText : (block.translated_text || block.ocr_text || '')
      const fontSize = isSelected && editedFontSize ? editedFontSize : (block.font_size || 16)

      // Scale bbox to canvas size
      const scaledBbox = {
        x: bbox.x * currentScale,
        y: bbox.y * currentScale,
        width: bbox.width * currentScale,
        height: bbox.height * currentScale,
      }

      // Draw white background (mask) - 100% opaque to hide any underlying text
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(scaledBbox.x, scaledBbox.y, scaledBbox.width, scaledBbox.height)

      // Draw text
      if (displayText) {
        const scaledFontSize = fontSize * currentScale
        ctx.font = `${scaledFontSize}px "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "SimHei", Arial, sans-serif`
        ctx.fillStyle = '#000000'
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

      // Draw bounding box
      ctx.strokeStyle = isSelected ? '#3b82f6' : '#10b981'
      ctx.lineWidth = isSelected ? 3 : 2
      ctx.strokeRect(scaledBbox.x, scaledBbox.y, scaledBbox.width, scaledBbox.height)

      // Draw resize handle for selected block
      if (isSelected) {
        const handleSize = 10
        ctx.fillStyle = '#3b82f6'
        ctx.fillRect(
          scaledBbox.x + scaledBbox.width - handleSize,
          scaledBbox.y + scaledBbox.height - handleSize,
          handleSize,
          handleSize
        )
      }
    })
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (isDragging || isResizing) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / scale
    const y = (e.clientY - rect.top) / scale

    // Find clicked text block
    for (const block of textBlocks) {
      const bbox = block.bbox
      if (
        x >= bbox.x &&
        x <= bbox.x + bbox.width &&
        y >= bbox.y &&
        y <= bbox.y + bbox.height
      ) {
        setSelectedBlock(block)
        setEditedText(block.translated_text || block.ocr_text || '')
        setEditedFontSize(block.font_size || 16)
        setEditedBbox(block.bbox)
        return
      }
    }

    // Click outside - deselect
    setSelectedBlock(null)
  }

  function handleCanvasMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!selectedBlock || !editedBbox) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / scale
    const y = (e.clientY - rect.top) / scale

    // Check if clicking resize handle
    const handleSize = 10 / scale
    if (
      x >= editedBbox.x + editedBbox.width - handleSize &&
      x <= editedBbox.x + editedBbox.width &&
      y >= editedBbox.y + editedBbox.height - handleSize &&
      y <= editedBbox.y + editedBbox.height
    ) {
      setIsResizing(true)
      setDragStart({ x: e.clientX, y: e.clientY })
      return
    }

    // Check if clicking inside bbox for dragging
    if (
      x >= editedBbox.x &&
      x <= editedBbox.x + editedBbox.width &&
      y >= editedBbox.y &&
      y <= editedBbox.y + editedBbox.height
    ) {
      setIsDragging(true)
      setDragStart({ x: e.clientX - editedBbox.x * scale, y: e.clientY - editedBbox.y * scale })
    }
  }

  function handleCanvasMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!selectedBlock || !editedBbox) return

    if (isDragging) {
      const newX = (e.clientX - dragStart.x) / scale
      const newY = (e.clientY - dragStart.y) / scale

      setEditedBbox({
        ...editedBbox,
        x: Math.max(0, Math.min(newX, imageSize.width - editedBbox.width)),
        y: Math.max(0, Math.min(newY, imageSize.height - editedBbox.height)),
      })
    } else if (isResizing) {
      const deltaX = (e.clientX - dragStart.x) / scale
      const deltaY = (e.clientY - dragStart.y) / scale

      setEditedBbox({
        ...editedBbox,
        width: Math.max(20, editedBbox.width + deltaX),
        height: Math.max(20, editedBbox.height + deltaY),
      })
      setDragStart({ x: e.clientX, y: e.clientY })
    }
  }

  function handleCanvasMouseUp() {
    setIsDragging(false)
    setIsResizing(false)
  }

  async function handleSave() {
    if (!selectedBlock || !editedBbox) return

    setSaving(true)
    try {
      await onSave(selectedBlock.id, {
        translated_text: editedText,
        font_size: editedFontSize,
        bbox: editedBbox,
      })

      // Update local state
      const updatedBlocks = textBlocks.map((block) =>
        block.id === selectedBlock.id
          ? { ...block, translated_text: editedText, font_size: editedFontSize, bbox: editedBbox }
          : block
      )
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
    setEditedText(selectedBlock.translated_text || selectedBlock.ocr_text || '')
    setEditedFontSize(selectedBlock.font_size || 16)
    setEditedBbox(selectedBlock.bbox)
  }

  async function handleDelete() {
    if (!selectedBlock) return

    setSaving(true)
    try {
      await onSave(selectedBlock.id, {
        translated_text: '', // 清空翻译文本
        font_size: 0,
      })

      // Close editor and reload page
      setSelectedBlock(null)
      setSaving(false)
      onClose()
    } catch (error) {
      console.error('Failed to delete:', error)
      alert('删除失败，请重试')
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
              <div className="mt-4 text-sm text-slate-600 dark:text-slate-400">
                <p>💡 点击文本框选择，拖动移动位置，拖动右下角调整大小</p>
                <p>已翻译: {textBlocks.filter(b => b.translated_text).length} / {textBlocks.length}</p>
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
                      value={editedText}
                      onChange={(e) => setEditedText(e.target.value)}
                      className="w-full min-h-[100px] p-2 border rounded mt-1 text-sm"
                      placeholder="输入译文..."
                    />
                  </div>

                  <div>
                    <Label htmlFor="font-size">字体大小: {editedFontSize}px</Label>
                    <Slider
                      id="font-size"
                      min={8}
                      max={120}
                      step={1}
                      value={[editedFontSize]}
                      onValueChange={(value) => setEditedFontSize(value[0])}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-slate-500">位置与尺寸</Label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <div>
                        <Label htmlFor="bbox-x" className="text-xs">X</Label>
                        <Input
                          id="bbox-x"
                          type="number"
                          value={Math.round(editedBbox?.x || 0)}
                          onChange={(e) => setEditedBbox(prev => prev ? { ...prev, x: Number(e.target.value) } : null)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div>
                        <Label htmlFor="bbox-y" className="text-xs">Y</Label>
                        <Input
                          id="bbox-y"
                          type="number"
                          value={Math.round(editedBbox?.y || 0)}
                          onChange={(e) => setEditedBbox(prev => prev ? { ...prev, y: Number(e.target.value) } : null)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div>
                        <Label htmlFor="bbox-width" className="text-xs">宽度</Label>
                        <Input
                          id="bbox-width"
                          type="number"
                          value={Math.round(editedBbox?.width || 0)}
                          onChange={(e) => setEditedBbox(prev => prev ? { ...prev, width: Number(e.target.value) } : null)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div>
                        <Label htmlFor="bbox-height" className="text-xs">高度</Label>
                        <Input
                          id="bbox-height"
                          type="number"
                          value={Math.round(editedBbox?.height || 0)}
                          onChange={(e) => setEditedBbox(prev => prev ? { ...prev, height: Number(e.target.value) } : null)}
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
                      删除文本块
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
