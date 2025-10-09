'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Loader2, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

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
    } catch (err) {
      console.error('Failed to load project:', err)
      setError(err instanceof Error ? err.message : 'Failed to load project')
    } finally {
      setLoading(false)
    }
  }

  async function handleStartTranslation() {
    if (!project || isTranslating) return

    const confirmed = confirm(
      `Start translation for ${pages.length} page(s)?\n\nThis will use AI to detect and translate text.`
    )

    if (!confirmed) return

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

          ctx.drawImage(img, 0, 0)

          for (const block of page.textBlocks) {
            if (!block.translated_text?.trim()) continue

            const { bbox, translated_text, font_size } = block

            // Use original font size if available, otherwise estimate
            let fontSize = font_size || Math.max(14, Math.floor(bbox.height * 0.65))

            // Set font with proper weight
            ctx.font = `500 ${fontSize}px "Microsoft YaHei", "SimHei", "Arial", sans-serif`
            ctx.textBaseline = 'middle'

            // Calculate how many characters can fit per line
            const charWidth = fontSize * 0.9 // Chinese characters are roughly square
            const maxCharsPerLine = Math.max(1, Math.floor((bbox.width * 0.9) / charWidth))
            const lines = wrapTextForCanvas(translated_text, maxCharsPerLine)

            // Adjust font size if text doesn't fit
            const lineHeight = fontSize * 1.2
            const totalTextHeight = lines.length * lineHeight

            if (totalTextHeight > bbox.height * 0.95) {
              // Text is too tall, reduce font size
              fontSize = Math.max(10, Math.floor((bbox.height * 0.95) / (lines.length * 1.2)))
              ctx.font = `500 ${fontSize}px "Microsoft YaHei", "SimHei", "Arial", sans-serif`
            }

            const adjustedLineHeight = fontSize * 1.2

            // Draw white background with slight opacity
            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
            ctx.fillRect(bbox.x, bbox.y, bbox.width, bbox.height)

            // Draw text
            ctx.fillStyle = '#000000'
            ctx.textAlign = 'center'

            const startY = bbox.y + (bbox.height - lines.length * adjustedLineHeight) / 2 + adjustedLineHeight / 2

            lines.forEach((line, idx) => {
              const y = startY + idx * adjustedLineHeight
              ctx.fillText(line, bbox.x + bbox.width / 2, y)
            })
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

      setTranslationProgress('')
    } catch (err) {
      console.error('Download failed:', err)
      alert(err instanceof Error ? err.message : 'Download failed')
      setTranslationProgress('')
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
            <Link href="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </div>
        </nav>
        <div className="container mx-auto px-4 py-12 max-w-4xl">
          <Card className="border-2 border-red-200 bg-red-50 dark:bg-red-950/30">
            <CardContent className="py-12 text-center">
              <h2 className="text-2xl font-bold mb-2 text-red-600 dark:text-red-400">Error</h2>
              <p className="text-slate-600 dark:text-slate-400">{error || 'Project not found'}</p>
              <Link href="/translate">
                <Button className="mt-6">Try Again</Button>
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
          <Link href="/translate">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              New Project
            </Button>
          </Link>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-12 max-w-6xl">
        {/* Success Message */}
        <Card className="mb-8 border-2 border-green-200 bg-green-50 dark:bg-green-950/30">
          <CardContent className="py-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <div>
                <h3 className="text-lg font-bold text-green-900 dark:text-green-100">Upload Successful!</h3>
                <p className="text-green-700 dark:text-green-300">
                  Your project has been created with {pages.length} page{pages.length !== 1 ? 's' : ''}
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
                <span>📖 {project.total_pages} pages</span>
                <span>🌐 {project.source_language} → {project.target_language}</span>
                <span>📊 Status: {project.status}</span>
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
        <h2 className="text-2xl font-bold mb-4">Pages</h2>
        {pages.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {pages.map((page) => (
              <Card key={page.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="aspect-[3/4] bg-slate-200 dark:bg-slate-800 relative">
                    {page.original_blob_url && (
                      <img
                        src={page.original_blob_url}
                        alt={`Page ${page.page_index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium">Page {page.page_index + 1}</p>
                    <p className="text-xs text-muted-foreground">
                      {page.width} × {page.height}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-slate-600 dark:text-slate-400">No pages found</p>
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
                  <p className="font-medium">Translating...</p>
                  <p className="text-sm text-muted-foreground">{translationProgress}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Next Steps */}
        <Card className="mt-8 bg-blue-50 dark:bg-blue-950/30 border-blue-200">
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              <li>✅ Project created successfully</li>
              <li>✅ {pages.length} page{pages.length !== 1 ? 's' : ''} uploaded</li>
              <li>
                {project?.status === 'ready' || project?.status === 'processing'
                  ? '✅ Translation completed'
                  : project?.status === 'failed'
                  ? '❌ Translation failed'
                  : '⏳ Ready to translate'}
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
                      Translating...
                    </>
                  ) : (
                    <>🤖 Start AI Translation</>
                  )}
                </Button>
              )}
              {project?.status === 'ready' && (
                <Button
                  onClick={handleDownloadTranslated}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                >
                  📥 Download Translated Pages
                </Button>
              )}
              <Link href="/translate">
                <Button variant="outline">Upload Another Project</Button>
              </Link>
              <Link href="/">
                <Button variant="outline">Back to Home</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
