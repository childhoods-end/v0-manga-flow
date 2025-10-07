import logger from '@/lib/logger'

export type ModerationAction = 'allow' | 'mask' | 'flag' | 'block'

export interface ModerationResult {
  action: ModerationAction
  reason?: string
  flaggedCategories?: string[]
  confidence?: number
  maskedText?: string
}

export interface ModerationContext {
  originalText: string
  translatedText: string
  contentRating?: string
  userAge?: number
}

/**
 * ModerationGateway - Content moderation and policy enforcement
 *
 * IMPORTANT: This gateway enforces content policies and never bypasses them.
 * It provides three actions:
 * - allow: Content passes moderation
 * - mask: Content is masked (e.g., replaced with •••)
 * - flag: Content is flagged for manual review
 * - block: Content is blocked entirely
 */
export class ModerationGateway {
  private openaiApiKey: string | null

  constructor() {
    this.openaiApiKey = process.env.OPENAI_MODERATION_API_KEY || null
  }

  /**
   * Moderate content through multiple layers
   */
  async moderate(context: ModerationContext): Promise<ModerationResult> {
    // Layer 1: Keyword-based filter
    const keywordResult = this.keywordFilter(context)
    if (keywordResult.action !== 'allow') {
      logger.warn({ reason: keywordResult.reason }, 'Content blocked by keyword filter')
      return keywordResult
    }

    // Layer 2: Age-gate check
    const ageGateResult = this.ageGateCheck(context)
    if (ageGateResult.action !== 'allow') {
      logger.warn({ reason: ageGateResult.reason }, 'Content blocked by age gate')
      return ageGateResult
    }

    // Layer 3: OpenAI Moderation API (if configured)
    if (this.openaiApiKey) {
      try {
        const openaiResult = await this.openaiModeration(context)
        if (openaiResult.action !== 'allow') {
          logger.warn({ reason: openaiResult.reason }, 'Content flagged by OpenAI moderation')
          return openaiResult
        }
      } catch (error) {
        logger.error({ error }, 'OpenAI moderation failed, flagging for manual review')
        return {
          action: 'flag',
          reason: 'moderation_api_error',
        }
      }
    }

    // All checks passed
    return { action: 'allow' }
  }

  /**
   * Keyword-based content filter
   */
  private keywordFilter(context: ModerationContext): ModerationResult {
    const { originalText, translatedText } = context

    // Define prohibited patterns (example - customize as needed)
    const prohibitedPatterns = [
      /\b(violence|gore|extreme)\b/i,
      /\b(explicit|nsfw)\b/i,
      // Add more patterns as needed
    ]

    const combinedText = `${originalText} ${translatedText}`.toLowerCase()

    for (const pattern of prohibitedPatterns) {
      if (pattern.test(combinedText)) {
        return {
          action: 'flag',
          reason: 'keyword_match',
          maskedText: this.maskSensitiveText(translatedText),
        }
      }
    }

    return { action: 'allow' }
  }

  /**
   * Age-gate verification
   */
  private ageGateCheck(context: ModerationContext): ModerationResult {
    const { contentRating, userAge } = context

    if (!contentRating || !userAge) {
      return { action: 'allow' }
    }

    const minAges: Record<string, number> = {
      general: 0,
      teen: 13,
      mature: 16,
      explicit: 18,
    }

    const requiredAge = minAges[contentRating] || 0

    if (userAge < requiredAge) {
      logger.warn(
        { userAge, requiredAge, contentRating },
        'User age insufficient for content rating'
      )
      return {
        action: 'block',
        reason: 'age_restriction',
      }
    }

    return { action: 'allow' }
  }

  /**
   * OpenAI Moderation API integration
   */
  private async openaiModeration(context: ModerationContext): Promise<ModerationResult> {
    if (!this.openaiApiKey) {
      return { action: 'allow' }
    }

    try {
      const response = await fetch('https://api.openai.com/v1/moderations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.openaiApiKey}`,
        },
        body: JSON.stringify({
          input: context.translatedText,
        }),
      })

      if (!response.ok) {
        throw new Error(`OpenAI Moderation API error: ${response.status}`)
      }

      const data = await response.json()
      const result = data.results[0]

      if (result.flagged) {
        const flaggedCategories = Object.keys(result.categories).filter(
          (cat) => result.categories[cat]
        )

        // Determine action based on category scores
        const highestScore = Math.max(...Object.values(result.category_scores) as number[])

        if (highestScore > 0.8) {
          return {
            action: 'block',
            reason: 'high_risk_content',
            flaggedCategories,
            confidence: highestScore,
          }
        } else if (highestScore > 0.5) {
          return {
            action: 'flag',
            reason: 'moderate_risk_content',
            flaggedCategories,
            confidence: highestScore,
            maskedText: this.maskSensitiveText(context.translatedText),
          }
        } else {
          return {
            action: 'mask',
            reason: 'low_risk_content',
            flaggedCategories,
            confidence: highestScore,
            maskedText: this.maskSensitiveText(context.translatedText),
          }
        }
      }

      return { action: 'allow' }
    } catch (error) {
      logger.error({ error }, 'OpenAI moderation request failed')
      throw error
    }
  }

  /**
   * Mask sensitive text
   */
  private maskSensitiveText(text: string): string {
    // Replace all alphanumeric characters with bullets
    return text.replace(/[a-zA-Z0-9]/g, '•')
  }
}

// Singleton instance
export const moderationGateway = new ModerationGateway()
