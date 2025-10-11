import OpenAI from 'openai'
import { v2 as translate } from '@google-cloud/translate'

export type TranslationProvider = 'openai' | 'anthropic' | 'google'

export interface TranslationBlock {
  id: string
  text: string
}

export interface TranslationResult {
  id: string
  originalText: string
  translatedText: string
  provider: TranslationProvider
}

/**
 * Translate multiple text blocks using the specified provider
 */
export async function translateBlocks(
  blocks: TranslationBlock[],
  sourceLang: string,
  targetLang: string,
  provider: TranslationProvider = 'openai'
): Promise<TranslationResult[]> {
  if (blocks.length === 0) {
    return []
  }

  switch (provider) {
    case 'openai':
      return translateWithOpenAI(blocks, sourceLang, targetLang)
    case 'anthropic':
      return translateWithAnthropic(blocks, sourceLang, targetLang)
    case 'google':
      return translateWithGoogle(blocks, sourceLang, targetLang)
    default:
      throw new Error(`Unsupported translation provider: ${provider}`)
  }
}

/**
 * Translate using OpenAI GPT-4
 */
async function translateWithOpenAI(
  blocks: TranslationBlock[],
  sourceLang: string,
  targetLang: string
): Promise<TranslationResult[]> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured')
  }

  const openai = new OpenAI({ apiKey })

  const languageNames: Record<string, string> = {
    ja: 'Japanese',
    en: 'English',
    zh: 'Chinese (Simplified)',
    ko: 'Korean',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
  }

  const sourceLanguage = languageNames[sourceLang] || sourceLang
  const targetLanguage = languageNames[targetLang] || targetLang

  // Prepare the prompt
  const textsToTranslate = blocks.map((block, index) => `[${index}]: ${block.text}`).join('\n')

  const systemPrompt = `You are an expert manga translator with deep understanding of both ${sourceLanguage} and ${targetLanguage} cultures.

CRITICAL RULES:
1. Translate naturally as a native ${targetLanguage} speaker would say it - NOT word-for-word
2. Capture the emotion, tone, and subtext - make it feel authentic and alive
3. Use natural ${targetLanguage} expressions, idioms, and speech patterns
4. Keep it concise for speech bubbles, but prioritize naturalness over brevity
5. For casual speech, use contractions and natural flow (e.g., "I'm" not "I am", "你们" not "你们各位")
6. Preserve character personality: formal/informal, polite/rude, energetic/calm
7. Sound effects: adapt culturally (Japanese ドキドキ → Chinese 怦怦 or 砰砰)

AVOID:
❌ Mechanical word-for-word translation
❌ Unnatural grammar or stiff phrasing
❌ Overly formal language unless character is formal
❌ Literal translation of idioms

Return each translation on a new line as: [index]: translated_text`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: textsToTranslate },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    })

    const translatedText = response.choices[0]?.message?.content || ''

    // Parse the response
    const results: TranslationResult[] = []
    const lines = translatedText.split('\n').filter((line) => line.trim())

    for (const block of blocks) {
      const blockIndex = blocks.indexOf(block)
      const pattern = new RegExp(`\\[${blockIndex}\\]:\\s*(.+)`)

      let translatedText = block.text // fallback to original if not found

      for (const line of lines) {
        const match = line.match(pattern)
        if (match && match[1]) {
          translatedText = match[1].trim()
          break
        }
      }

      results.push({
        id: block.id,
        originalText: block.text,
        translatedText: translatedText,
        provider: 'openai',
      })
    }

    return results
  } catch (error) {
    console.error('OpenAI translation error:', error)
    throw new Error(`OpenAI translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Translate using Anthropic Claude
 */
async function translateWithAnthropic(
  blocks: TranslationBlock[],
  sourceLang: string,
  targetLang: string
): Promise<TranslationResult[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured')
  }

  // Implement Anthropic translation here
  throw new Error('Anthropic translation not implemented yet')
}

/**
 * Translate using Google Cloud Translation API
 */
async function translateWithGoogle(
  blocks: TranslationBlock[],
  sourceLang: string,
  targetLang: string
): Promise<TranslationResult[]> {
  try {
    console.log('Starting Google Cloud Translation')
    const startTime = Date.now()

    // Use same credentials as Google Vision
    const credentialsJson = process.env.GOOGLE_CLOUD_VISION_KEY

    if (!credentialsJson) {
      throw new Error('GOOGLE_CLOUD_VISION_KEY environment variable not set')
    }

    const credentials = JSON.parse(credentialsJson)

    const translateClient = new translate.Translate({
      projectId: credentials.project_id,
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key,
      },
    })

    // Language code mapping (Google uses different codes)
    const googleLangCode: Record<string, string> = {
      ja: 'ja',
      en: 'en',
      zh: 'zh-CN',
      ko: 'ko',
      es: 'es',
      fr: 'fr',
      de: 'de',
    }

    const sourceCode = googleLangCode[sourceLang] || sourceLang
    const targetCode = googleLangCode[targetLang] || targetLang

    // Translate all blocks in parallel
    const texts = blocks.map((b) => b.text)

    const [translations] = await translateClient.translate(texts, {
      from: sourceCode,
      to: targetCode,
    })

    const translationArray = Array.isArray(translations) ? translations : [translations]

    const results: TranslationResult[] = blocks.map((block, index) => ({
      id: block.id,
      originalText: block.text,
      translatedText: translationArray[index] || block.text,
      provider: 'google',
    }))

    const elapsed = Math.round((Date.now() - startTime) / 1000)
    console.log(`Google Translation completed ${blocks.length} blocks in ${elapsed}s`)

    return results
  } catch (error) {
    console.error('Google Translation error:', error)
    throw new Error(
      `Google Translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}
