import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import createMiddleware from 'next-intl/middleware'
import { locales } from '@/lib/i18n-config'

// Create the next-intl middleware
const intlMiddleware = createMiddleware({
  locales,
  defaultLocale: 'zh',
  localePrefix: 'as-needed',
})

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // First handle internationalization
  const intlResponse = intlMiddleware(request)

  // Protected routes that require authentication
  const protectedRoutes = ['/translate', '/projects']

  // Check if current path requires authentication
  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route))

  if (!isProtectedRoute) {
    return intlResponse
  }

  // Create response with proper cookie handling
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: any) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Check authentication
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    // No valid session, redirect to auth page
    const redirectUrl = new URL('/auth', request.url)
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Valid session, continue
  return response
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
