import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

/**
 * Machine Translation API
 * Uses Google Translate or DeepL API
 */
export async function POST(request: NextRequest) {
  try {
    const { text, source, target } = await request.json()

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    // Use Google Translate API if available
    if (process.env.GOOGLE_TRANSLATE_API_KEY) {
      const url = new URL('https://translation.googleapis.com/language/translate/v2')
      url.searchParams.set('key', process.env.GOOGLE_TRANSLATE_API_KEY)
      url.searchParams.set('q', text)
      url.searchParams.set('target', target || 'zh-CN')
      if (source && source !== 'auto') {
        url.searchParams.set('source', source)
      }

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        throw new Error(`Google Translate API error: ${response.statusText}`)
      }

      const data = await response.json()
      const translation = data.data?.translations?.[0]?.translatedText || text

      return NextResponse.json({ translation })
    }

    // Fallback: Use DeepL if available
    if (process.env.DEEPL_API_KEY) {
      const response = await fetch('https://api-free.deepl.com/v2/translate', {
        method: 'POST',
        headers: {
          'Authorization': `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          text,
          target_lang: target.toUpperCase().replace('-', '_'),
          ...(source && source !== 'auto' ? { source_lang: source.toUpperCase() } : {}),
        }),
      })

      if (!response.ok) {
        throw new Error(`DeepL API error: ${response.statusText}`)
      }

      const data = await response.json()
      const translation = data.translations?.[0]?.text || text

      return NextResponse.json({ translation })
    }

    // No translation service available, return original text
    console.warn('No translation service configured. Set GOOGLE_TRANSLATE_API_KEY or DEEPL_API_KEY')
    return NextResponse.json({ translation: text })

  } catch (error) {
    console.error('Translation error:', error)
    return NextResponse.json(
      { error: 'Translation failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
