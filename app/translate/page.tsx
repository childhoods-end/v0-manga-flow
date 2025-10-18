'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Upload, ArrowLeft, Loader2, LogOut, User } from 'lucide-react'
import Link from 'next/link'
import { SUPPORTED_LANGUAGES, CONTENT_RATINGS } from '@/lib/constants'
import { supabase } from '@/lib/supabase/client'
import { track } from '@vercel/analytics'
import { BetaNotice } from '@/components/beta-notice'

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
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    // Get current user
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserEmail(user.email || null)
      }
    })
  }, [])

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
      alert('请输入项目名称')
      return
    }

    if (files.length === 0) {
      alert('请选择要上传的文件')
      return
    }

    if (!rightsDeclaration) {
      alert('请确认您拥有翻译此内容的合法权利')
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
        let errorMessage = '上传失败'
        try {
          const error = await response.json()
          errorMessage = error.error || errorMessage
        } catch (e) {
          errorMessage = `上传失败，状态码: ${response.status}`
        }
        throw new Error(errorMessage)
      }

      const responseText = await response.text()
      if (!responseText) {
        throw new Error('服务器响应为空')
      }

      const result = JSON.parse(responseText)

      // Track translation upload
      const user = await supabase.auth.getUser()
      track('translation_uploaded', {
        user_id: user.data.user?.id,
        project_id: result.projectId,
        image_count: files.length,
        source_lang: sourceLang,
        target_lang: targetLang,
      })

      // Navigate to project page
      if (result.projectId) {
        router.push(`/projects/${result.projectId}`)
      } else {
        alert('上传成功！翻译处理已开始。')
        router.push('/dashboard')
      }
    } catch (error) {
      console.error('Upload failed:', error)
      const errorMsg = error instanceof Error ? error.message : '上传失败，请重试。'

      // Show detailed error message
      const detailedMsg = `上传失败: ${errorMsg}\n\n请检查:\n1. Supabase 已在 .env.local 中配置\n2. 数据库表已创建\n3. 查看浏览器控制台 (F12) 获取更多详情`

      alert(detailedMsg)
    } finally {
      setIsUploading(false)
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    track('user_logged_out')
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950">
      {/* Header */}
      <nav className="border-b bg-white/50 dark:bg-slate-900/50 backdrop-blur-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold text-black dark:text-white">
            MangaFlow
          </Link>
          <div className="flex items-center gap-3">
            {userEmail && (
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <User className="w-4 h-4" />
                <span>{userEmail}</span>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              退出登录
            </Button>
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
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent mb-2">
            漫画翻译
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            用 AI 精准翻译，即刻阅读漫画
          </p>
        </div>

        {/* Upload Form */}
        <Card className="border-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur">
          <CardHeader>
            <CardTitle>上传漫画文件</CardTitle>
            <CardDescription>支持 JPG、PNG、WEBP、ZIP、CBZ 格式</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium mb-2">
                项目名称 *
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：我的漫画翻译项目"
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Language Selection */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="sourceLang" className="block text-sm font-medium mb-2">
                  源语言 *
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
                  目标语言 *
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
                内容分级 *
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
              <label className="block text-sm font-medium mb-2">上传文件 *</label>
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
                        已选择 {files.length} 个文件
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
                        拖拽文件到此处或点击浏览
                      </p>
                      <p className="text-sm text-slate-500">
                        支持格式：JPG、PNG、WEBP、ZIP、CBZ
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
                我确认拥有翻译和修改此内容的合法权利，或该内容属于公共领域。
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
                  上传中...
                </>
              ) : (
                '开始翻译'
              )}
            </Button>
          </CardContent>
        </Card>
        <BetaNotice />
      </div>
    </div>
  )
}
