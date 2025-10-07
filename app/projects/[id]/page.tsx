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
    setTranslationProgress('Starting translation...')

    try {
      const response = await fetch(`/api/translate/${projectId}`, {
        method: 'POST',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Translation failed')
      }

      const result = await response.json()

      setTranslationProgress(
        `Translation completed! Processed ${result.processedPages}/${result.totalPages} pages`
      )

      // Reload project to get updated status
      setTimeout(() => {
        loadProject()
        setIsTranslating(false)
        setTranslationProgress('')
      }, 2000)
    } catch (err) {
      console.error('Translation failed:', err)
      alert(err instanceof Error ? err.message : 'Translation failed')
      setIsTranslating(false)
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
        </Card>

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
                <Button className="bg-gradient-to-r from-green-600 to-emerald-600">
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
