"use client"

import { Button } from "@/components/ui/button"
import { Upload, Sparkles, ArrowRight, Languages, Wand2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"

export function HeroSection() {
  const router = useRouter()

  async function handleStartTranslating() {
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      // User is logged in, go to translate page
      router.push('/translate')
    } else {
      // User not logged in, redirect to auth with return URL
      router.push('/auth?redirect=/translate')
    }
  }

  return (
    <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-28">
      {/* Background gradient effects */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute left-1/4 top-0 h-[500px] w-[500px] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-1/4 top-1/3 h-[400px] w-[400px] rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          {/* Announcement badge */}
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-4 py-1.5 text-sm">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">AI 驱动，秒级翻译</span>
          </div>

          {/* Main headline */}
          <h1 className="mx-auto max-w-4xl text-balance text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            用 <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">AI 精准翻译</span> 即刻阅读漫画
          </h1>

          {/* Subheadline */}
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
            打破语言障碍，畅享来自世界各地的漫画、条漫和图像小说。一站式上传、翻译、阅读，轻松无阻。
          </p>

          {/* CTA Buttons */}
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              size="lg"
              onClick={handleStartTranslating}
              className="group h-12 gap-2 bg-primary px-8 text-base font-semibold text-primary-foreground hover:bg-primary/90"
            >
              免费开始翻译
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-8 text-base font-semibold bg-transparent">
              观看演示
            </Button>
          </div>

          {/* How it works demo */}
          <Card className="mx-auto mt-16 max-w-4xl overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm">
            <div className="border-b border-border/50 bg-muted/30 px-6 py-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground">使用方法</span>
              </div>
            </div>
            <div className="p-8 sm:p-12">
              <div className="grid gap-8 md:grid-cols-3">
                {/* Step 1 */}
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <Upload className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold">1. 上传</h3>
                  <p className="text-sm text-muted-foreground">
                    上传您的漫画或图像小说页面（JPG、PNG 或 ZIP 文件）
                  </p>
                </div>

                {/* Step 2 */}
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <Wand2 className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold">2. AI 处理</h3>
                  <p className="text-sm text-muted-foreground">
                    AI 自动检测文本气泡并进行上下文感知翻译
                  </p>
                </div>

                {/* Step 3 */}
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <Languages className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold">3. 下载</h3>
                  <p className="text-sm text-muted-foreground">
                    获取已翻译的页面，随时阅读您喜爱的语言版本
                  </p>
                </div>
              </div>

              {/* CTA */}
              <div className="mt-8 text-center">
                <Button
                  size="lg"
                  onClick={handleStartTranslating}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  立即免费试用
                </Button>
              </div>
            </div>
          </Card>

          {/* Social proof */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-8 w-8 rounded-full border-2 border-background bg-muted" />
                ))}
              </div>
              <span>10,000+ 活跃用户</span>
            </div>
            <div>★★★★★ 4.9/5 评分</div>
            <div>500K+ 页面已翻译</div>
          </div>
        </div>
      </div>
    </section>
  )
}
