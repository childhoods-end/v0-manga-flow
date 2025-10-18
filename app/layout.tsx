import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import "./globals.css"

export const metadata: Metadata = {
  title: "MangaFlow - AI-Powered Comic Translation",
  description:
    "Translate manga, webtoons, and comics instantly with AI. Break language barriers and enjoy comics from around the world.",
  generator: "v0.app",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale}>
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable} antialiased`}>
        <NextIntlClientProvider messages={messages}>
          <Suspense fallback={null}>
            {children}
            <Analytics />
          </Suspense>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
