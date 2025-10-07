'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Upload, ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { SUPPORTED_LANGUAGES, CONTENT_RATINGS } from '@/lib/constants'

export default function TranslatePage() {
  const router = useRouter()
  const [files, setFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [title, setTitle] = useState('')
  const [sourceLang, setSourceLang] = useState('ja')
  const [targetLang, setTargetLang] = useState('en')
  const [contentRating, setContentRating] = useState('general')
  const [rightsDeclaration, setRightsDeclaration] = useState(false)

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files
    if (selectedFiles && selectedFiles.length > 0) {
      setFiles(Array.from(selectedFiles))
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const droppedFiles = e.dataTransfer.files
    if (droppedFiles && droppedFiles.length > 0) {
      setFiles(Array.from(droppedFiles))
    }
  }

  const handleUpload = async () => {
    if (!title.trim()) {
      alert('Please enter a project title')
      return
    }

    if (files.length === 0) {
      alert('Please select files to upload')
      return
    }

    if (!rightsDeclaration) {
      alert('Please confirm that you have the rights to translate this content')
      return
    }

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('title', title)
      formData.append('sourceLang', sourceLang)
      formData.append('targetLang', targetLang)
      formData.append('contentRating', contentRating)
      formData.append('rightsDeclaration', rightsDeclaration.toString())

      files.forEach((file) => {
        formData.append('files', file)
      })

      const response = await fetch('/api/upload-simple', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        let errorMessage = 'Upload failed'
        try {
          const error = await response.json()
          errorMessage = error.error || errorMessage
        } catch (e) {
          errorMessage = `Upload failed with status ${response.status}`
        }
        throw new Error(errorMessage)
      }

      const responseText = await response.text()
      if (!responseText) {
        throw new Error('Empty response from server')
      }

      const result = JSON.parse(responseText)

      // Navigate to project page
      if (result.projectId) {
        router.push(`/projects/${result.projectId}`)
      } else {
        alert('Upload successful! Translation processing has started.')
        router.push('/dashboard')
      }
    } catch (error) {
      console.error('Upload failed:', error)
      alert(error instanceof Error ? error.message : 'Upload failed. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950">
      {/* Header */}
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
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent mb-2">
            Translate Your Comics
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Upload your manga or comic pages and let AI translate them instantly
          </p>
        </div>

        {/* Upload Form */}
        <Card className="border-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur">
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
            <CardDescription>Provide information about your translation project</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium mb-2">
                Project Title *
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., One Piece Chapter 1"
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Language Selection */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="sourceLang" className="block text-sm font-medium mb-2">
                  Source Language *
                </label>
                <select
                  id="sourceLang"
                  value={sourceLang}
                  onChange={(e) => setSourceLang(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="targetLang" className="block text-sm font-medium mb-2">
                  Target Language *
                </label>
                <select
                  id="targetLang"
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Content Rating */}
            <div>
              <label htmlFor="contentRating" className="block text-sm font-medium mb-2">
                Content Rating *
              </label>
              <select
                id="contentRating"
                value={contentRating}
                onChange={(e) => setContentRating(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(CONTENT_RATINGS).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.label}
                  </option>
                ))}
              </select>
            </div>

            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium mb-2">Upload Files *</label>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                    : 'border-slate-300 dark:border-slate-700 hover:border-blue-400'
                }`}
              >
                <input
                  type="file"
                  id="fileInput"
                  multiple
                  accept="image/jpeg,image/png,image/webp,application/zip,.cbz"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="fileInput" className="cursor-pointer">
                  <Upload className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                  {files.length > 0 ? (
                    <div>
                      <p className="text-lg font-medium text-blue-600 dark:text-blue-400 mb-2">
                        {files.length} file(s) selected
                      </p>
                      <div className="max-h-32 overflow-y-auto text-sm text-slate-600 dark:text-slate-400">
                        {files.map((file, index) => (
                          <div key={index}>{file.name}</div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-lg font-medium mb-2">
                        Drop your files here or click to browse
                      </p>
                      <p className="text-sm text-slate-500">
                        Supports: JPG, PNG, WEBP, ZIP, CBZ
                      </p>
                    </>
                  )}
                </label>
              </div>
            </div>

            {/* Rights Declaration */}
            <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
              <input
                type="checkbox"
                id="rights"
                checked={rightsDeclaration}
                onChange={(e) => setRightsDeclaration(e.target.checked)}
                className="mt-1"
              />
              <label htmlFor="rights" className="text-sm text-slate-700 dark:text-slate-300">
                I confirm that I have the legal rights to translate and modify this content, or it is in the public domain.
              </label>
            </div>

            {/* Submit Button */}
            <Button
              onClick={handleUpload}
              disabled={isUploading}
              size="lg"
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                'Start Translation'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
