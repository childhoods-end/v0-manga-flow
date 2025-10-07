import type { TranslateProvider, TranslationBlock, TranslationResult, TranslateOptions } from './index'
import logger from '@/lib/logger'

export const deeplProvider: TranslateProvider = {
  name: 'deepl',

  async translate(
    blocks: TranslationBlock[],
    sourceLang: string,
    targetLang: string,
    options?: TranslateOptions
  ): Promise<TranslationResult[]> {
    const apiKey = process.env.DEEPL_API_KEY

    if (!apiKey) {
      throw new Error('DEEPL_API_KEY not configured')
    }

    try {
      // DeepL requires specific language codes
      const sourceCode = mapLanguageCode(sourceLang)
      const targetCode = mapLanguageCode(targetLang)

      const results: TranslationResult[] = []

      // DeepL doesn't support batch translation with IDs, so translate one by one
      for (const block of blocks) {
        const params = new URLSearchParams({
          auth_key: apiKey,
          text: block.text,
          source_lang: sourceCode,
          target_lang: targetCode,
          preserve_formatting: options?.preserveFormatting ? '1' : '0',
        })

        const response = await fetch('https://api-free.deepl.com/v2/translate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params,
        })

        if (!response.ok) {
          const error = await response.text()
          throw new Error(`DeepL API error: ${response.status} ${error}`)
        }

        const data = await response.json()
        const translation = data.translations[0]

        results.push({
          id: block.id,
          originalText: block.text,
          translatedText: translation.text,
          tokensUsed: Math.ceil(block.text.length / 4), // Estimate
        })
      }

      logger.info({ blockCount: blocks.length }, 'DeepL translation completed')

      return results
    } catch (error) {
      logger.error({ error }, 'DeepL translation failed')
      throw error
    }
  },
}

function mapLanguageCode(lang: string): string {
  const mapping: Record<string, string> = {
    ja: 'JA',
    en: 'EN',
    zh: 'ZH',
    ko: 'KO',
    es: 'ES',
    fr: 'FR',
    de: 'DE',
  }
  return mapping[lang] || lang.toUpperCase()
}
