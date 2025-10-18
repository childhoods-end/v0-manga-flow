import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'

export const locales = ['zh', 'en', 'ja', 'ko'] as const
export type Locale = (typeof locales)[number]

export const localeNames: Record<Locale, string> = {
  zh: '中文',
  en: 'English',
  ja: '日本語',
  ko: '한국어',
}

export default getRequestConfig(async () => {
  // Get locale from cookie or default to 'zh'
  const cookieStore = await cookies()
  const locale = (cookieStore.get('NEXT_LOCALE')?.value || 'zh') as Locale

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  }
})
