import { Card } from "@/components/ui/card"
import { Languages, Zap, Shield, Globe, Sparkles, Download } from "lucide-react"

const features = [
  {
    icon: Zap,
    title: "Lightning Fast",
    description:
      "Translate entire comic pages in seconds with our advanced AI engine. No more waiting hours for manual translations.",
  },
  {
    icon: Languages,
    title: "50+ Languages",
    description:
      "Support for major languages including English, Japanese, Korean, Chinese, Spanish, French, and many more.",
  },
  {
    icon: Shield,
    title: "Context-Aware",
    description:
      "Our AI understands manga context, slang, and cultural nuances to deliver accurate, natural translations.",
  },
  {
    icon: Globe,
    title: "Text Preservation",
    description:
      "Maintains original formatting, speech bubbles, and artistic style while seamlessly integrating translations.",
  },
  {
    icon: Sparkles,
    title: "Smart Detection",
    description:
      "Automatically detects and extracts text from complex layouts, handwritten fonts, and stylized typography.",
  },
  {
    icon: Download,
    title: "Export Options",
    description: "Download translated pages in high quality or read directly in our optimized web reader.",
  },
]

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            Features
          </div>
          <h2 className="mt-6 text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            Everything you need for comic translation
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
            Powerful features designed to make comic translation effortless, accurate, and accessible to everyone.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <Card
                key={index}
                className="group relative overflow-hidden border-border/50 bg-card/50 p-8 backdrop-blur-sm transition-all hover:border-primary/50 hover:shadow-lg"
              >
                <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-primary/5 transition-transform group-hover:scale-150" />
                <div className="relative">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-6 text-xl font-semibold">{feature.title}</h3>
                  <p className="mt-3 leading-relaxed text-muted-foreground">{feature.description}</p>
                </div>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}
