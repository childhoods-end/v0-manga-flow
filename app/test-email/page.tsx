'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Mail, CheckCircle, XCircle } from 'lucide-react'
import Link from 'next/link'

export default function TestEmailPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string; details?: any } | null>(null)

  async function handleTest() {
    if (!email) {
      alert('请输入邮箱地址')
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const response = await fetch(`/api/test-email?email=${encodeURIComponent(email)}`)
      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({
        success: false,
        message: '请求失败',
        details: error instanceof Error ? error.message : '未知错误',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950">
      {/* Header */}
      <nav className="border-b bg-white/50 dark:bg-slate-900/50 backdrop-blur-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold text-black dark:text-white">
            MangaFlow
          </Link>
          <Link href="/">
            <Button variant="outline" size="sm">
              返回首页
            </Button>
          </Link>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-12 max-w-2xl">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Mail className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-2xl">邮件发送测试</CardTitle>
                <CardDescription>测试 Supabase SMTP 邮件发送功能</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Input Section */}
            <div className="space-y-2">
              <Label htmlFor="test-email">邮箱地址</Label>
              <Input
                id="test-email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <Button onClick={handleTest} disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  发送测试邮件中...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  发送测试邮件
                </>
              )}
            </Button>

            {/* Result Section */}
            {result && (
              <Card className={result.success ? 'border-green-200 bg-green-50 dark:bg-green-950/30' : 'border-red-200 bg-red-50 dark:bg-red-950/30'}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    {result.success ? (
                      <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 space-y-2">
                      <h3 className={`font-semibold ${result.success ? 'text-green-900 dark:text-green-100' : 'text-red-900 dark:text-red-100'}`}>
                        {result.success ? '✅ 邮件发送成功！' : '❌ 邮件发送失败'}
                      </h3>
                      <p className={result.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
                        {result.message}
                      </p>

                      {result.success && (
                        <div className="mt-4 p-3 bg-white dark:bg-slate-800 rounded border border-green-200 dark:border-green-800">
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            📬 请检查邮箱 <strong>{email}</strong>
                          </p>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            💡 如果收件箱没有，请检查<strong>垃圾邮件</strong>文件夹
                          </p>
                        </div>
                      )}

                      {result.details && (
                        <details className="mt-3">
                          <summary className="cursor-pointer text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200">
                            查看详细信息
                          </summary>
                          <pre className="mt-2 p-3 bg-slate-100 dark:bg-slate-800 rounded text-xs overflow-auto">
                            {JSON.stringify(result.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Troubleshooting Section */}
            <div className="border-t pt-6 space-y-3">
              <h3 className="font-semibold text-lg">故障排查步骤：</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li>
                  <strong>检查 Supabase SMTP 配置</strong>
                  <p className="ml-6 mt-1">Project Settings → Auth → SMTP Settings</p>
                  <p className="ml-6 text-xs text-slate-500">确认 "Enable Custom SMTP" 已开启</p>
                </li>
                <li>
                  <strong>验证 Gmail 设置</strong>
                  <p className="ml-6 mt-1">确认两步验证已启用，应用专用密码正确</p>
                </li>
                <li>
                  <strong>查看 Supabase 日志</strong>
                  <p className="ml-6 mt-1">Authentication → Logs → 筛选 "Email"</p>
                  <p className="ml-6 text-xs text-slate-500">查看详细的错误信息</p>
                </li>
                <li>
                  <strong>检查浏览器控制台</strong>
                  <p className="ml-6 mt-1">按 F12 查看是否有错误信息</p>
                </li>
              </ol>

              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-900 dark:text-blue-100 font-semibold mb-2">
                  📚 配置指南
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  查看完整的 Gmail SMTP 配置指南：
                  <a
                    href="https://github.com/childhoods-end/v0-manga-flow/blob/main/docs/GMAIL_SMTP_SETUP.md"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline ml-1 hover:text-blue-900 dark:hover:text-blue-100"
                  >
                    GMAIL_SMTP_SETUP.md
                  </a>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Links */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-6">
              <h4 className="font-semibold mb-2">Supabase Dashboard</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                查看邮件发送日志和配置
              </p>
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm" className="w-full">
                  打开 Supabase →
                </Button>
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h4 className="font-semibold mb-2">Gmail 设置</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                生成应用专用密码
              </p>
              <a
                href="https://myaccount.google.com/apppasswords"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm" className="w-full">
                  打开 Gmail →
                </Button>
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
