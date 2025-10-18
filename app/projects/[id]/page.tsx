'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Loader2, CheckCircle, Edit } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { track } from '@vercel/analytics'
import { TextBlockEditor } from '@/components/text-block-editor'

export default function ProjectPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const [project, setProject] = useState<any>(null)
  const [pages, setPages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isTranslating, setIsTranslating] = useState(false)
  const [translationProgress, setTranslationProgress] = useState<string>('')
  const [showTranslations, setShowTranslations] = useState(false)
  const [translations, setTranslations] = useState<any>(null)
  const [editingPage, setEditingPage] = useState<any>(null)
  const [editingTextBlocks, setEditingTextBlocks] = useState<any[]>([])
  const [loadingEditor, setLoadingEditor] = useState(false)

  useEffect(() => {
    loadProject()
  }, [projectId])

  async function loadProject() {
    try {
      // Load project details
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single()

      if (projectError) throw projectError

      setProject(projectData)

      // Load pages
      const { data: pagesData, error: pagesError } = await supabase
        .from('pages')
        .select('*')
        .eq('project_id', projectId)
        .order('page_index')

      if (pagesError) throw pagesError

      setPages(pagesData || [])

      // Debug: Check if pages have processed URLs
      console.log('📊 项目状态:', {
        status: (projectData as any)?.status,
        totalPages: pagesData?.length || 0,
        pagesWithRendered: pagesData?.filter((p: any) => p.processed_blob_url).length || 0,
      })

      // Auto-render if translation is complete but no rendered images
      if ((projectData as any)?.status === 'ready' && pagesData && pagesData.length > 0) {
        const missingRendered = pagesData.filter((p: any) => !p.processed_blob_url)
        if (missingRendered.length > 0) {
          console.warn(`⚠️ ${missingRendered.length} pages missing rendered images. Auto-rendering...`)
          // Trigger rendering for missing pages
          for (const page of missingRendered) {
            fetch(`/api/debug-render/${(page as any).id}`, { method: 'POST' })
              .then(r => r.json())
              .then(result => {
                if (result.success) {
                  console.log(`✅ Auto-rendered page ${(page as any).page_index + 1}`)
                  loadProject() // Reload to get updated URLs
                }
              })
              .catch(err => console.error('Auto-render failed:', err))
          }
        }
      }
    } catch (err) {
      console.error('Failed to load project:', err)
      setError(err instanceof Error ? err.message : 'Failed to load project')
    } finally {
      setLoading(false)
    }
  }

  async function handleStartTranslation() {
    if (!project || isTranslating) return

    setIsTranslating(true)
    setTranslationProgress('Creating translation job...')

    try {
      // Create translation job
      const response = await fetch(`/api/translation-job/create/${projectId}`, {
        method: 'POST',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to create translation job')
      }

      const result = await response.json()
      const jobId = result.jobId

      setTranslationProgress('Translation job created. Processing...')

      // Poll for status and trigger worker if still pending
      let pollCount = 0
      const pollInterval = setInterval(async () => {
        try {
          pollCount++
          const statusResponse = await fetch(`/api/translation-job/status/${projectId}`)
          const statusData = await statusResponse.json()

          if (statusData.exists) {
            const progress = statusData.progress || 0
            const current = statusData.currentPage || 0
            const total = statusData.totalPages || 0

            setTranslationProgress(
              `Translating... ${progress}% (${current}/${total} pages)`
            )

            // If still pending after 10 seconds, manually trigger worker
            if (statusData.status === 'pending' && pollCount > 5) {
              console.log('Job still pending, manually triggering worker...')
              fetch(`/api/translation-job/trigger/${jobId}`, {
                method: 'POST'
              }).catch(err => console.error('Failed to trigger worker:', err))
            }

            if (statusData.status === 'completed') {
              clearInterval(pollInterval)
              setTranslationProgress('Translation completed!')

              // Track translation completion
              const user = await supabase.auth.getUser()
              track('translation_completed', {
                user_id: user.data.user?.id,
                project_id: projectId,
                page_count: total,
              })

              setTimeout(() => {
                loadProject()
                setIsTranslating(false)
                setTranslationProgress('')
              }, 2000)
            } else if (statusData.status === 'failed') {
              clearInterval(pollInterval)
              throw new Error(statusData.errorMessage || 'Translation failed')
            }
          }
        } catch (pollError) {
          console.error('Poll error:', pollError)
        }
      }, 2000) // Poll every 2 seconds

      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval)
        if (isTranslating) {
          setTranslationProgress('Translation is taking longer than expected. Please check back later.')
          setIsTranslating(false)
        }
      }, 300000)
    } catch (err) {
      console.error('Translation failed:', err)
      alert(err instanceof Error ? err.message : 'Translation failed')
      setIsTranslating(false)
      setTranslationProgress('')
    }
  }

  async function loadTranslations() {
    try {
      const response = await fetch(`/api/projects/${projectId}/translations`)
      if (!response.ok) {
        throw new Error('Failed to load translations')
      }
      const data = await response.json()
      setTranslations(data)
      setShowTranslations(true)
    } catch (err) {
      console.error('Failed to load translations:', err)
      alert('Failed to load translations')
    }
  }

  async function handleEditPage(page: any) {
    setLoadingEditor(true)
    try {
      console.log('[EditPage] Page URLs:', {
        original: page.original_blob_url,
        processed: page.processed_blob_url,
        areSame: page.original_blob_url === page.processed_blob_url
      })

      const response = await fetch(`/api/pages/${page.id}/text-blocks`)
      if (!response.ok) throw new Error('Failed to load text blocks')

      const data = await response.json()
      setEditingPage(page)
      setEditingTextBlocks(data.textBlocks || [])
    } catch (err) {
      console.error('Failed to load text blocks:', err)
      alert('加载文本块失败')
    } finally {
      setLoadingEditor(false)
    }
  }

  async function handleSaveTextBlock(blockId: string, updates: any) {
    const response = await fetch(`/api/text-blocks/${blockId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })

    if (!response.ok) {
      throw new Error('Failed to save text block')
    }

    // Update local text blocks state
    setEditingTextBlocks(prev =>
      prev.map(block =>
        block.id === blockId
          ? { ...block, ...updates }
          : block
      )
    )

    // Reload project to get updated rendered images
    await loadProject()
  }

  async function handleDeleteTextBlock(blockId: string) {
    const response = await fetch(`/api/text-blocks/${blockId}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error('Failed to delete text block')
    }

    // Remove from local text blocks state
    setEditingTextBlocks(prev => prev.filter(block => block.id !== blockId))

    // Wait a bit for server-side rendering to complete, then reload
    setTimeout(async () => {
      await loadProject()
    }, 2000)
  }

  function handleCloseEditor() {
    setEditingPage(null)
    setEditingTextBlocks([])
  }

  function wrapTextForCanvas(text: string, maxCharsPerLine: number): string[] {
    const lines: string[] = []
    if (maxCharsPerLine < 1) return [text]

    let currentLine = ''
    for (const char of text) {
      if (currentLine.length >= maxCharsPerLine) {
        lines.push(currentLine)
        currentLine = char
      } else {
        currentLine += char
      }
    }
    if (currentLine) lines.push(currentLine)
    return lines
  }

  async function handleDownloadTranslated() {
    try {
      setTranslationProgress('Loading translation data...')

      const response = await fetch(`/api/download/${projectId}?format=json`)
      if (!response.ok) throw new Error('Failed to load translation data')

      const data = await response.json()
      const { projectTitle, pages } = data

      const JSZip = (await import('jszip')).default
      const zip = new JSZip()

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i]
        setTranslationProgress(`Processing page ${i + 1}/${pages.length}...`)

        try {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          await new Promise((resolve, reject) => {
            img.onload = resolve
            img.onerror = reject
            img.src = page.imageUrl
          })

          const canvas = document.createElement('canvas')
          canvas.width = img.width
          canvas.height = img.height
          const ctx = canvas.getContext('2d')!

          // Enable high-quality rendering
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'

          ctx.drawImage(img, 0, 0)

          for (const block of page.textBlocks) {
            if (!block.translated_text?.trim()) continue

            const { bbox, translated_text, font_size, text_orientation } = block
            const isVertical = text_orientation === 'vertical'

            // Draw white background
            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
            ctx.fillRect(bbox.x, bbox.y, bbox.width, bbox.height)

            if (isVertical) {
              renderVerticalText(ctx, translated_text, bbox, font_size)
            } else {
              renderHorizontalText(ctx, translated_text, bbox, font_size)
            }
          }

          const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'))
          zip.file(`page_${String(page.pageIndex + 1).padStart(3, '0')}.png`, blob)
        } catch (err) {
          console.error(`Failed to process page ${page.pageIndex}:`, err)
        }
      }

      setTranslationProgress('Creating ZIP file...')
      const zipBlob = await zip.generateAsync({ type: 'blob' })

      const url = window.URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${projectTitle}_translated.zip`
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()

      setTimeout(() => {
        window.URL.revokeObjectURL(url)
        if (a.parentNode) document.body.removeChild(a)
      }, 100)

      // Track download
      const user = await supabase.auth.getUser()
      track('translation_downloaded', {
        user_id: user.data.user?.id,
        project_id: projectId,
        page_count: pages.length,
      })

      setTranslationProgress('')
    } catch (err) {
      console.error('Download failed:', err)
      alert(err instanceof Error ? err.message : 'Download failed')
      setTranslationProgress('')
    }

    // Render horizontal text with aggressive fitting
    function renderHorizontalText(
      ctx: CanvasRenderingContext2D,
      text: string,
      bbox: { x: number; y: number; width: number; height: number },
      originalFontSize: number
    ) {
      const fontFamily = '"Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "SimHei", "Arial", sans-serif'
      const minFontSize = 6
      const maxWidth = bbox.width * 0.8 // 20% margin
      const maxHeight = bbox.height * 0.85 // 15% margin top+bottom

      let fontSize = originalFontSize || Math.round(bbox.height * 0.65)
      let lines: string[] = []
      let lineHeight = 0

      // Aggressively reduce font size until text fits
      while (fontSize >= minFontSize) {
        ctx.font = `500 ${fontSize}px ${fontFamily}`
        lineHeight = fontSize * 1.1 // Tight line height

        lines = wrapByMeasure(ctx, text, maxWidth)
        const totalHeight = lines.length * lineHeight

        if (totalHeight <= maxHeight) {
          break // Found a fitting size
        }

        fontSize -= 1 // Reduce 1px at a time
      }

      // Draw text centered
      ctx.fillStyle = '#000000'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = `500 ${fontSize}px ${fontFamily}`

      const startY = bbox.y + (bbox.height - lines.length * lineHeight) / 2 + lineHeight / 2

      lines.forEach((line, idx) => {
        const y = startY + idx * lineHeight
        ctx.fillText(line, bbox.x + bbox.width / 2, y)
      })
    }

    // Render vertical text (top-to-bottom)
    function renderVerticalText(
      ctx: CanvasRenderingContext2D,
      text: string,
      bbox: { x: number; y: number; width: number; height: number },
      originalFontSize: number
    ) {
      const fontFamily = '"Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "SimHei", "Arial", sans-serif'
      const minFontSize = 6
      const maxHeight = bbox.height * 0.85 // 15% margin
      const maxWidth = bbox.width * 0.8 // 20% margin

      const chars = text.split('')
      let fontSize = originalFontSize || Math.round(bbox.width * 0.8)

      // Find largest font size that fits
      while (fontSize >= minFontSize) {
        ctx.font = `500 ${fontSize}px ${fontFamily}`

        const charHeight = fontSize * 1.05 // Tight spacing
        const totalHeight = chars.length * charHeight

        // Also check that font size doesn't exceed width
        if (totalHeight <= maxHeight && fontSize <= maxWidth) {
          break
        }

        fontSize -= 1
      }

      // Draw text vertically centered
      ctx.fillStyle = '#000000'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = `500 ${fontSize}px ${fontFamily}`

      const charHeight = fontSize * 1.05
      const totalHeight = chars.length * charHeight
      const startY = bbox.y + (bbox.height - totalHeight) / 2 + charHeight / 2
      const centerX = bbox.x + bbox.width / 2

      chars.forEach((char, idx) => {
        const y = startY + idx * charHeight
        ctx.fillText(char, centerX, y)
      })
    }

    // Wrap text by measured pixel width
    function wrapByMeasure(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
      const chars = text.split('')
      const lines: string[] = []
      let currentLine = ''

      for (const char of chars) {
        const testLine = currentLine + char
        const metrics = ctx.measureText(testLine)

        if (metrics.width > maxWidth && currentLine.length > 0) {
          lines.push(currentLine)
          currentLine = char
        } else {
          currentLine = testLine
        }
      }

      if (currentLine) {
        lines.push(currentLine)
      }

      return lines.length > 0 ? lines : [text]
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-slate-600 dark:text-slate-400">Loading project...</p>
        </div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950">
        <nav className="border-b bg-white/50 dark:bg-slate-900/50 backdrop-blur-lg sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              MangaFlow
            </Link>
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  返回首页
                </Button>
              </Link>
            </div>
          </div>
        </nav>
        <div className="container mx-auto px-4 py-12 max-w-4xl">
          <Card className="border-2 border-red-200 bg-red-50 dark:bg-red-950/30">
            <CardContent className="py-12 text-center">
              <h2 className="text-2xl font-bold mb-2 text-red-600 dark:text-red-400">错误</h2>
              <p className="text-slate-600 dark:text-slate-400">{error || '项目未找到'}</p>
              <Link href="/translate">
                <Button className="mt-6">重试</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950">
      {/* Header */}
      <nav className="border-b bg-white/50 dark:bg-slate-900/50 backdrop-blur-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            MangaFlow
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/translate">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                新建项目
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-12 max-w-6xl">
        {/* Success Message */}
        <Card className="mb-8 border-2 border-green-200 bg-green-50 dark:bg-green-950/30">
          <CardContent className="py-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <div>
                <h3 className="text-lg font-bold text-green-900 dark:text-green-100">上传成功！</h3>
                <p className="text-green-700 dark:text-green-300">
                  项目已创建，共 {pages.length} 页
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Project Details */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-3xl">{project.title}</CardTitle>
            <CardDescription>
              <div className="flex flex-wrap gap-4 mt-2">
                <span>📖 {project.total_pages} 页</span>
                <span>🌐 {project.source_language} → {project.target_language}</span>
                <span>📊 状态: {project.status}</span>
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Button onClick={loadTranslations} variant="outline">
                查看翻译文本
              </Button>
              {project.status === 'ready' && (
                <Button onClick={handleDownloadTranslated} disabled={!!translationProgress}>
                  {translationProgress || '下载翻译图片'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Translations Display */}
        {showTranslations && translations && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>翻译文本预览</CardTitle>
              <CardDescription>
                共 {translations.totalPages} 页，{translations.pages.reduce((sum: number, p: any) => sum + p.textBlocks.length, 0)} 个文本块
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6 max-h-[600px] overflow-y-auto">
                {translations.pages.map((page: any) => (
                  page.textBlocks.length > 0 && (
                    <div key={page.pageIndex} className="border-b pb-4">
                      <h3 className="font-bold mb-3 text-lg">第 {page.pageIndex + 1} 页</h3>
                      <div className="space-y-3">
                        {page.textBlocks.map((block: any, idx: number) => (
                          <div key={idx} className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg">
                            <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                              原文：{block.ocrText}
                            </div>
                            <div className="font-medium text-blue-600 dark:text-blue-400">
                              译文：{block.translatedText}
                            </div>
                            {block.confidence && (
                              <div className="text-xs text-slate-500 mt-1">
                                置信度：{Math.round(block.confidence)}%
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                ))}
              </div>
              <Button onClick={() => setShowTranslations(false)} variant="outline" className="mt-4">
                关闭
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Pages Grid */}
        <h2 className="text-2xl font-bold mb-4">页面列表</h2>
        {pages.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {pages.map((page) => (
              <Card key={page.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="aspect-[3/4] bg-slate-200 dark:bg-slate-800 relative group">
                    {page.processed_blob_url ? (
                      <img
                        src={page.processed_blob_url}
                        alt={`第 ${page.page_index + 1} 页（已翻译）`}
                        className="w-full h-full object-cover"
                      />
                    ) : page.original_blob_url ? (
                      <img
                        src={page.original_blob_url}
                        alt={`第 ${page.page_index + 1} 页`}
                        className="w-full h-full object-cover"
                      />
                    ) : null}
                    {page.processed_blob_url && (
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button
                          onClick={() => handleEditPage(page)}
                          disabled={loadingEditor}
                          className="bg-white text-black hover:bg-slate-100"
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          编辑文本
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium">第 {page.page_index + 1} 页</p>
                    <p className="text-xs text-muted-foreground">
                      {page.width} × {page.height}
                    </p>
                    {page.processed_blob_url && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                        ✓ 已翻译
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-slate-600 dark:text-slate-400">未找到页面</p>
            </CardContent>
          </Card>
        )}

        {/* Translation Progress */}
        {isTranslating && (
          <Card className="mt-8 bg-blue-50 dark:bg-blue-950/30 border-blue-200">
            <CardContent className="py-8">
              <div className="flex items-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                <div>
                  <p className="font-medium">翻译中...</p>
                  <p className="text-sm text-muted-foreground">{translationProgress}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Next Steps */}
        <Card className="mt-8 bg-blue-50 dark:bg-blue-950/30 border-blue-200">
          <CardHeader>
            <CardTitle>操作</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              <li>✅ 项目创建成功</li>
              <li>✅ 已上传 {pages.length} 页</li>
              <li>
                {project?.status === 'ready' || project?.status === 'processing'
                  ? '✅ 翻译完成'
                  : project?.status === 'failed'
                  ? '❌ 翻译失败'
                  : '⏳ 准备翻译'}
              </li>
            </ul>
            <div className="mt-6 flex gap-3 flex-wrap">
              {(project?.status === 'pending' || project?.status === 'failed') && (
                <Button
                  onClick={handleStartTranslation}
                  disabled={isTranslating}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                >
                  {isTranslating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      翻译中...
                    </>
                  ) : (
                    <>🤖 开始 AI 翻译</>
                  )}
                </Button>
              )}
              {project?.status === 'ready' && (
                <Button
                  onClick={handleDownloadTranslated}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                >
                  📥 下载翻译后的页面
                </Button>
              )}
              <Link href="/translate">
                <Button variant="outline">上传新项目</Button>
              </Link>
              <Link href="/">
                <Button variant="outline">返回首页</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Text Block Editor */}
      {editingPage && (
        <TextBlockEditor
          pageId={editingPage.id}
          imageUrl={editingPage.original_blob_url}
          textBlocks={editingTextBlocks}
          onSave={handleSaveTextBlock}
          onDelete={handleDeleteTextBlock}
          onClose={handleCloseEditor}
        />
      )}
    </div>
  )
}
