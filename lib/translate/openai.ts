import type { TranslateProvider, TranslationBlock, TranslationResult, TranslateOptions } from './index'
import logger from '@/lib/logger'

export const openaiProvider: TranslateProvider = {
  name: 'openai',

  async translate(
    blocks: TranslationBlock[],
    sourceLang: string,
    targetLang: string,
    options?: TranslateOptions
  ): Promise<TranslationResult[]> {
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured')
    }

    try {
      const glossaryText = options?.glossary
        ? `\n\nGlossary:\n${Object.entries(options.glossary)
            .map(([k, v]) => `${k} -> ${v}`)
            .join('\n')}`
        : ''

      const systemPrompt = `You are a professional manga translator. Translate from ${sourceLang} to ${targetLang} maintaining natural flow and manga conventions.${glossaryText}`

      const userPrompt = `Translate these text blocks. Respond ONLY with JSON array:
${JSON.stringify(blocks.map(b => ({ id: b.id, text: b.text })), null, 2)}

Format: [{"id": "block-id", "translation": "translated text"}]`

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: options?.model || 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`OpenAI API error: ${response.status} ${error}`)
      }

      const data = await response.json()
      const content = data.choices[0].message.content

      // Parse response
      let translations
      try {
        const parsed = JSON.parse(content)
        translations = parsed.translations || parsed
      } catch {
        // Fallback: extract JSON array
        const jsonMatch = content.match(/\[[\s\S]*\]/)
        if (!jsonMatch) throw new Error('Failed to parse OpenAI response')
        translations = JSON.parse(jsonMatch[0])
      }

      const results: TranslationResult[] = blocks.map((block) => {
        const translation = translations.find((t: any) => t.id === block.id)
        return {
          id: block.id,
          originalText: block.text,
          translatedText: translation?.translation || block.text,
          tokensUsed: Math.ceil((data.usage.total_tokens || 0) / blocks.length),
        }
      })

      logger.info(
        {
          blockCount: blocks.length,
          tokensUsed: data.usage.total_tokens,
        },
        'OpenAI translation completed'
      )

      return results
    } catch (error) {
      logger.error({ error }, 'OpenAI translation failed')
      throw error
    }
  },
}
