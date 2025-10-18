"use client"

import { Button } from "@/components/ui/button"
import { Languages, Menu, X } from "lucide-react"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { LanguageSwitcher } from "@/components/language-switcher"
import { useTranslations } from 'next-intl'

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const router = useRouter()
  const t = useTranslations()

  async function handleStartTranslating() {
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      router.push('/translate')
    } else {
      router.push('/auth?redirect=/translate')
    }
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-lg">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Languages className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold">MangaFlow</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden items-center gap-8 md:flex">
          <Link
            href="#features"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Features
          </Link>
          <Link
            href="#how-it-works"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            How It Works
          </Link>
          <Link
            href="#pricing"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Pricing
          </Link>
        </div>

        {/* Auth Buttons */}
        <div className="hidden items-center gap-3 md:flex">
          <LanguageSwitcher />
          <Link href="/auth">
            <Button variant="ghost" size="sm">
              {t('auth.signIn')}
            </Button>
          </Link>
          <Button
            size="sm"
            onClick={handleStartTranslating}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {t('home.getStarted')}
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <button className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle menu">
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="border-t border-border bg-background md:hidden">
          <div className="space-y-1 px-4 py-4">
            <Link
              href="#features"
              className="block rounded-lg px-3 py-2 text-base font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => setMobileMenuOpen(false)}
            >
              Features
            </Link>
            <Link
              href="#how-it-works"
              className="block rounded-lg px-3 py-2 text-base font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => setMobileMenuOpen(false)}
            >
              How It Works
            </Link>
            <Link
              href="#pricing"
              className="block rounded-lg px-3 py-2 text-base font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => setMobileMenuOpen(false)}
            >
              Pricing
            </Link>
            <div className="flex flex-col gap-2 pt-4">
              <div className="pb-2">
                <LanguageSwitcher />
              </div>
              <Link href="/auth">
                <Button variant="outline" className="w-full bg-transparent">
                  {t('auth.signIn')}
                </Button>
              </Link>
              <Button
                onClick={() => {
                  setMobileMenuOpen(false)
                  handleStartTranslating()
                }}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {t('home.getStarted')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
