import { getRequestConfig } from 'next-intl/server'
import type { Locale } from '@/lib/i18n-config'

export default getRequestConfig(async ({ requestLocale }) => {
  // Get locale from request or default to 'zh'
  let locale = await requestLocale

  if (!locale) {
    locale = 'zh'
  }

  return {
    locale,
    messages: (await import(`./messages/${locale as Locale}.json`)).default,
  }
})
