import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export const runtime = 'edge'

/**
 * LLM Polish API
 * Uses OpenAI/Anthropic for manga dialogue polishing
 */
export async function POST(request: NextRequest) {
  try {
    const { system, user } = await request.json()

    if (!user) {
      return NextResponse.json({ error: 'User message is required' }, { status: 400 })
    }

    // Use OpenAI if available
    if (process.env.OPENAI_API_KEY) {
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      })

      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: system || 'You are a helpful assistant.' },
          { role: 'user', content: user },
        ],
        temperature: 0.7,
        max_tokens: 500,
      })

      const text = completion.choices[0]?.message?.content || user

      return NextResponse.json({ text })
    }

    // Use Anthropic Claude if available
    if (process.env.ANTHROPIC_API_KEY) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 500,
          system: system || 'You are a helpful assistant.',
          messages: [
            { role: 'user', content: user },
          ],
        }),
      })

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.statusText}`)
      }

      const data = await response.json()
      const text = data.content?.[0]?.text || user

      return NextResponse.json({ text })
    }

    // No LLM service available, return original text
    console.warn('No LLM service configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY')
    return NextResponse.json({ text: user })

  } catch (error) {
    console.error('LLM error:', error)
    return NextResponse.json(
      { error: 'LLM processing failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
