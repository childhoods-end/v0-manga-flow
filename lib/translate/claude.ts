import type { TranslateProvider, TranslationBlock, TranslationResult, TranslateOptions } from './index'
import logger from '@/lib/logger'

export const claudeProvider: TranslateProvider = {
  name: 'claude',

  async translate(
    blocks: TranslationBlock[],
    sourceLang: string,
    targetLang: string,
    options?: TranslateOptions
  ): Promise<TranslationResult[]> {
    const apiKey = process.env.ANTHROPIC_API_KEY

    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured')
    }

    try {
      // Build translation prompt
      const glossaryText = options?.glossary
        ? `\n\nGlossary (use these translations):\n${Object.entries(options.glossary)
            .map(([k, v]) => `${k} -> ${v}`)
            .join('\n')}`
        : ''

      const prompt = `You are a professional manga translator. Translate the following text blocks from ${sourceLang} to ${targetLang}.

Requirements:
- Maintain natural ${targetLang} flow
- Preserve onomatopoeia where appropriate
- Keep formatting (line breaks, punctuation)
- Use casual/informal tone typical of manga${glossaryText}

Text blocks to translate (JSON format):
${JSON.stringify(blocks.map(b => ({ id: b.id, text: b.text })), null, 2)}

Respond ONLY with a JSON array in this exact format:
[{"id": "block-id", "translation": "translated text"}]`

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: options?.model || 'claude-3-5-sonnet-20241022',
          max_tokens: 4096,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Claude API error: ${response.status} ${error}`)
      }

      const data = await response.json()
      const content = data.content[0].text

      // Parse JSON response
      const jsonMatch = content.match(/\[[\s\S]*\]/)
      if (!jsonMatch) {
        throw new Error('Failed to parse Claude response')
      }

      const translations = JSON.parse(jsonMatch[0])

      const results: TranslationResult[] = blocks.map((block) => {
        const translation = translations.find((t: any) => t.id === block.id)
        return {
          id: block.id,
          originalText: block.text,
          translatedText: translation?.translation || block.text,
          tokensUsed: Math.ceil(data.usage.input_tokens + data.usage.output_tokens),
        }
      })

      logger.info(
        {
          blockCount: blocks.length,
          tokensUsed: data.usage.input_tokens + data.usage.output_tokens,
        },
        'Claude translation completed'
      )

      return results
    } catch (error) {
      logger.error({ error }, 'Claude translation failed')
      throw error
    }
  },
}
