import type { TranslationProvider } from '@/lib/constants'

export interface TranslationBlock {
  id: string
  text: string
  context?: string
}

export interface TranslationResult {
  id: string
  originalText: string
  translatedText: string
  tokensUsed: number
}

export interface TranslateProvider {
  name: string
  translate(
    blocks: TranslationBlock[],
    sourceLang: string,
    targetLang: string,
    options?: TranslateOptions
  ): Promise<TranslationResult[]>
}

export interface TranslateOptions {
  glossary?: Record<string, string>
  preserveFormatting?: boolean
  model?: string
}

export async function translateBlocks(
  blocks: TranslationBlock[],
  sourceLang: string,
  targetLang: string,
  provider: TranslationProvider = 'claude',
  options?: TranslateOptions
): Promise<TranslationResult[]> {
  const providerInstance = getTranslationProvider(provider)
  return providerInstance.translate(blocks, sourceLang, targetLang, options)
}

function getTranslationProvider(providerName: TranslationProvider): TranslateProvider {
  switch (providerName) {
    case 'claude':
      return require('./claude').claudeProvider
    case 'openai':
      return require('./openai').openaiProvider
    case 'deepl':
      return require('./deepl').deeplProvider
    default:
      throw new Error(`Unknown translation provider: ${providerName}`)
  }
}
