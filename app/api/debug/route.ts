import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET() {
  const results: any = {
    timestamp: new Date().toISOString(),
    checks: {},
    errors: []
  }

  try {
    // 1. Check Supabase connection
    results.checks.supabaseConnection = {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT_SET',
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    }

    // 2. Check if tables exist
    try {
      const { data: tables, error: tablesError } = await supabaseAdmin
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .in('table_name', ['profiles', 'projects', 'pages', 'jobs'])

      if (tablesError) {
        results.errors.push(`Tables check error: ${tablesError.message}`)
      } else {
        results.checks.tables = tables
      }
    } catch (e) {
      results.errors.push(`Tables check failed: ${e}`)
    }

    // 3. Check if demo profile exists
    try {
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', '00000000-0000-0000-0000-000000000000')
        .maybeSingle()

      if (profileError) {
        results.errors.push(`Profile check error: ${profileError.message}`)
      } else {
        results.checks.demoProfile = profile ? 'EXISTS' : 'NOT_FOUND'
        results.checks.demoProfileData = profile
      }
    } catch (e) {
      results.errors.push(`Profile check failed: ${e}`)
    }

    // 4. Try to create a test profile
    try {
      const testId = '11111111-1111-1111-1111-111111111111'

      // First delete if exists
      await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', testId)

      // Then insert
      const { data: testProfile, error: insertError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: testId,
          email: 'test@example.com',
          role: 'user',
          plan: 'free',
        })
        .select()
        .single()

      if (insertError) {
        results.errors.push(`Test insert error: ${insertError.message}`)
        results.checks.canInsertProfile = false
      } else {
        results.checks.canInsertProfile = true
        // Clean up
        await supabaseAdmin.from('profiles').delete().eq('id', testId)
      }
    } catch (e) {
      results.errors.push(`Test insert failed: ${e}`)
    }

    // 5. Check environment variables
    results.checks.env = {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasBlobToken: !!process.env.BLOB_READ_WRITE_TOKEN,
      hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      useLocalStorage: process.env.USE_LOCAL_STORAGE === 'true',
    }

  } catch (error) {
    results.errors.push(`General error: ${error instanceof Error ? error.message : 'Unknown'}`)
  }

  return NextResponse.json(results, {
    headers: {
      'Content-Type': 'application/json',
    },
  })
}
