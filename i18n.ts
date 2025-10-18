import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'
import type { Locale } from '@/lib/i18n-config'
import { locales } from '@/lib/i18n-config'

export default getRequestConfig(async () => {
  // Get locale from cookie or default to 'zh'
  const cookieStore = await cookies()
  const localeCookie = cookieStore.get('NEXT_LOCALE')?.value

  // Validate and use locale from cookie, or fallback to default
  const locale = (localeCookie && locales.includes(localeCookie as Locale)
    ? localeCookie
    : 'zh') as Locale

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  }
})
