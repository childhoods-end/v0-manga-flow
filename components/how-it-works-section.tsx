import { Card } from "@/components/ui/card"
import { Upload, Wand2, Download, ArrowRight } from "lucide-react"

const steps = [
  {
    number: "01",
    icon: Upload,
    title: "Upload Your Comic",
    description:
      "Drag and drop your comic pages or upload from your device. We support all major image formats and PDFs.",
  },
  {
    number: "02",
    icon: Wand2,
    title: "AI Translation Magic",
    description:
      "Our AI detects text, understands context, and translates while preserving the original layout and style.",
  },
  {
    number: "03",
    icon: Download,
    title: "Read or Download",
    description: "Enjoy your translated comic in our reader or download high-quality images to read anywhere.",
  },
]

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative overflow-hidden bg-muted/30 py-20 sm:py-28">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute right-0 top-1/2 h-[600px] w-[600px] -translate-y-1/2 translate-x-1/3 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-4 py-1.5 text-sm font-medium text-accent">
            How It Works
          </div>
          <h2 className="mt-6 text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            Three simple steps to translated comics
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
            From upload to reading in under a minute. No technical knowledge required.
          </p>
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-3">
          {steps.map((step, index) => {
            const Icon = step.icon
            return (
              <div key={index} className="relative">
                <Card className="relative h-full border-border/50 bg-card p-8">
                  <div className="mb-6 flex items-start justify-between">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                      <Icon className="h-7 w-7" />
                    </div>
                    <span className="text-6xl font-bold text-muted/20">{step.number}</span>
                  </div>
                  <h3 className="text-2xl font-semibold">{step.title}</h3>
                  <p className="mt-3 leading-relaxed text-muted-foreground">{step.description}</p>
                </Card>
                {index < steps.length - 1 && (
                  <div className="absolute -right-4 top-1/2 hidden -translate-y-1/2 lg:block">
                    <ArrowRight className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
