import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Check, BookOpen, Users, Briefcase } from "lucide-react"

const plans = [
  {
    icon: BookOpen,
    name: "Free",
    description: "Perfect for casual readers",
    price: "$0",
    period: "forever",
    features: [
      "10 pages per month",
      "Basic translation quality",
      "Standard processing speed",
      "Watermarked downloads",
      "Community support",
    ],
    cta: "Get started",
    highlighted: false,
  },
  {
    icon: Users,
    name: "Pro",
    description: "For avid manga enthusiasts",
    price: "$12",
    period: "per month",
    features: [
      "500 pages per month",
      "Premium translation quality",
      "Priority processing",
      "No watermarks",
      "Advanced editing tools",
      "Email support",
    ],
    cta: "Start free trial",
    highlighted: true,
  },
  {
    icon: Briefcase,
    name: "Team",
    description: "For translation teams & publishers",
    price: "$49",
    period: "per month",
    features: [
      "Unlimited pages",
      "Highest quality translations",
      "Instant processing",
      "API access",
      "Custom glossaries",
      "Team collaboration",
      "Priority support",
    ],
    cta: "Contact sales",
    highlighted: false,
  },
]

export function ProductSection() {
  return (
    <section id="pricing" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            Pricing
          </div>
          <h2 className="mt-6 text-balance text-4xl font-bold tracking-tight sm:text-5xl">Choose your perfect plan</h2>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
            Start free and upgrade as you translate more. All plans include our core AI translation technology.
          </p>
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-3">
          {plans.map((plan, index) => {
            const Icon = plan.icon
            return (
              <Card
                key={index}
                className={`relative flex flex-col border-border/50 p-8 ${
                  plan.highlighted
                    ? "border-primary bg-card shadow-xl shadow-primary/10 ring-2 ring-primary/20"
                    : "bg-card/50"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-primary px-4 py-1 text-sm font-semibold text-primary-foreground">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" />
                </div>

                <h3 className="mt-6 text-2xl font-bold">{plan.name}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>

                <div className="mt-6 flex items-baseline gap-2">
                  <span className="text-5xl font-bold tracking-tight">{plan.price}</span>
                  <span className="text-muted-foreground">/ {plan.period}</span>
                </div>

                <ul className="mt-8 space-y-4 flex-1">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-3">
                      <Check className="h-5 w-5 shrink-0 text-primary" />
                      <span className="text-sm leading-relaxed text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={`mt-8 w-full ${
                    plan.highlighted
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  {plan.cta}
                </Button>
              </Card>
            )
          })}
        </div>

        {/* Additional info */}
        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            All plans include 14-day money-back guarantee. No credit card required for free plan.
          </p>
        </div>
      </div>
    </section>
  )
}
