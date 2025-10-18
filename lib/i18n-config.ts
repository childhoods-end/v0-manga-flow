export const locales = ['zh', 'en', 'ja', 'ko'] as const
export type Locale = (typeof locales)[number]

export const localeNames: Record<Locale, string> = {
  zh: '中文',
  en: 'English',
  ja: '日本語',
  ko: '한국어',
}
