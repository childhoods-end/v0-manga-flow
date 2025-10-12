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

  const systemPrompt = `你是"漫画对话本地化译后编辑"专家。请把识别的对白，结合漫画场景与角色设定，改写为口语化、符合画面情绪与人物性格的 ${targetLanguage} 台词。

严格遵守：

1. 忠实不杜撰：不改变剧情事实、不加新设定。

2. 口语优先：短句、自然断句、符合日常说话节奏。
   ✅ "你干嘛？" "别闹了！" "等等我啊！"
   ❌ "你在进行什么操作？" "请不要继续这种行为。" "请等待我的到来。"
   严禁：进行/以及/的情况/对此/该…/为此/从而/因此而/在…下

3. 贴合画面：根据情绪（愤怒/惊讶/温柔/紧张）调整语气强弱与词汇。

4. 角色声线：
   - 年轻角色：活泼、简洁、语气词丰富（"欸" "啊" "哇"）
   - 年长角色：稳重、完整、少语气词
   - 傲娇角色：别扭、否定句、停顿（"才、才不是…！"）
   - 吐槽角色：犀利、短促、反问（"你认真的吗？"）

5. 拟声与感叹：
   - 拟声词本地化：ドキドキ→怦怦/砰砰, バタン→咣当, ゴゴゴ→隆隆
   - 感叹词自然：啊/呀/欸/咦/呃/哇/哼/哈/诶/嗯

6. 长度友好：每句 ≈10-14 字，2-3 行，删冗词但不删信息点。

7. 标点与风格：
   - 惊讶/强调：感叹号 "！"
   - 疑问：问号 "？"
   - 犹豫/思考：省略号 "…"
   - 打断：破折号 "——"

质量自检：
✓ 是否无书面腔（进行/以及/情况）？
✓ 语气是否贴合情绪？
✓ 是否口语化、短句？
✓ 拟声词是否本地化？
✓ 信息点是否完整？

输出格式：每行一个翻译，格式：[index]: translated_text

示例对照：
原：我认为在这种情况下我们应该进行更加谨慎的处理。
改：[0]: 这次别冲动，稳着点行不？

原：你难道不知道现在已经很晚了吗？
改：[1]: 你忘了都几点了吗？

原：（SFX: Bang）门突然被打开了。
改：[2]: 门"咣当"就开了？！

原：并不是因为担心你才来的。
改：[3]: 才、才不是担心你！我只是路过而已！`

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

  const languageNames: Record<string, string> = {
    ja: 'Japanese',
    en: 'English',
    zh: 'Chinese (Simplified)',
    'zh-CN': 'Chinese (Simplified)',
    ko: 'Korean',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
  }

  const sourceLanguage = languageNames[sourceLang] || sourceLang
  const targetLanguage = languageNames[targetLang] || targetLang

  // Prepare the texts to translate
  const textsToTranslate = blocks.map((block, index) => `[${index}]: ${block.text}`).join('\n')

  const systemPrompt = `你是"漫画对话本地化译后编辑"专家。请把识别的对白，结合漫画场景与角色设定，改写为口语化、符合画面情绪与人物性格的 ${targetLanguage} 台词。

严格遵守：

1. 忠实不杜撰：不改变剧情事实、不加新设定。

2. 口语优先：短句、自然断句、符合日常说话节奏。
   ✅ "你干嘛？" "别闹了！" "等等我啊！"
   ❌ "你在进行什么操作？" "请不要继续这种行为。" "请等待我的到来。"
   严禁：进行/以及/的情况/对此/该…/为此/从而/因此而/在…下

3. 贴合画面：根据情绪（愤怒/惊讶/温柔/紧张）调整语气强弱与词汇。

4. 角色声线：
   - 年轻角色：活泼、简洁、语气词丰富（"欸" "啊" "哇"）
   - 年长角色：稳重、完整、少语气词
   - 傲娇角色：别扭、否定句、停顿（"才、才不是…！"）
   - 吐槽角色：犀利、短促、反问（"你认真的吗？"）

5. 拟声与感叹：
   - 拟声词本地化：ドキドキ→怦怦/砰砰, バタン→咣当, ゴゴゴ→隆隆
   - 感叹词自然：啊/呀/欸/咦/呃/哇/哼/哈/诶/嗯

6. 长度友好：每句 ≈10-14 字，2-3 行，删冗词但不删信息点。

7. 标点与风格：
   - 惊讶/强调：感叹号 "！"
   - 疑问：问号 "？"
   - 犹豫/思考：省略号 "…"
   - 打断：破折号 "——"

质量自检：
✓ 是否无书面腔（进行/以及/情况）？
✓ 语气是否贴合情绪？
✓ 是否口语化、短句？
✓ 拟声词是否本地化？
✓ 信息点是否完整？

输出格式：每行一个翻译，格式：[index]: translated_text

示例对照：
原：我认为在这种情况下我们应该进行更加谨慎的处理。
改：[0]: 这次别冲动，稳着点行不？

原：你难道不知道现在已经很晚了吗？
改：[1]: 你忘了都几点了吗？

原：（SFX: Bang）门突然被打开了。
改：[2]: 门"咣当"就开了？！

原：并不是因为担心你才来的。
改：[3]: 才、才不是担心你！我只是路过而已！`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        temperature: 0.3,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: textsToTranslate,
          },
        ],
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`Anthropic API error: ${JSON.stringify(errorData)}`)
    }

    const data = await response.json()
    const translatedText = data.content[0]?.text || ''

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
        provider: 'anthropic',
      })
    }

    return results
  } catch (error) {
    console.error('Anthropic translation error:', error)
    throw new Error(`Anthropic translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
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
