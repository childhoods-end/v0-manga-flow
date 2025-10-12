import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

// Client-side Supabase client with proper cookie storage for Next.js
export const supabase = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
