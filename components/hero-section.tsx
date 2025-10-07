"use client"

import { Button } from "@/components/ui/button"
import { Upload, Sparkles, ArrowRight } from "lucide-react"
import { Card } from "@/components/ui/card"

export function HeroSection() {
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
            <span className="text-muted-foreground">AI-powered translation in seconds</span>
          </div>

          {/* Main headline */}
          <h1 className="mx-auto max-w-4xl text-balance text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            Translate comics instantly with{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">AI precision</span>
          </h1>

          {/* Subheadline */}
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
            Break language barriers and enjoy manga, webtoons, and comics from around the world. Upload, translate, and
            read in your language—all in one seamless platform.
          </p>

          {/* CTA Buttons */}
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              size="lg"
              className="group h-12 gap-2 bg-primary px-8 text-base font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Start translating free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-8 text-base font-semibold bg-transparent">
              Watch demo
            </Button>
          </div>

          {/* Translation demo card */}
          <Card className="mx-auto mt-16 max-w-4xl overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm">
            <div className="border-b border-border/50 bg-muted/30 px-6 py-4">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-destructive/60" />
                <div className="h-3 w-3 rounded-full bg-accent/60" />
                <div className="h-3 w-3 rounded-full bg-primary/60" />
                <span className="ml-4 text-sm text-muted-foreground">Quick Translation</span>
              </div>
            </div>
            <div className="p-8 sm:p-12">
              <div className="flex flex-col items-center gap-6">
                <div className="flex h-32 w-full items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 transition-colors hover:border-primary/50 hover:bg-muted/50">
                  <div className="text-center">
                    <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                    <p className="mt-2 text-sm font-medium text-muted-foreground">
                      Drop your comic page here or click to upload
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Supports JPG, PNG, PDF up to 10MB</p>
                  </div>
                </div>
                <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto sm:px-12">
                  Upload & Translate
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
              <span>10,000+ active users</span>
            </div>
            <div>★★★★★ 4.9/5 rating</div>
            <div>500K+ pages translated</div>
          </div>
        </div>
      </div>
    </section>
  )
}
