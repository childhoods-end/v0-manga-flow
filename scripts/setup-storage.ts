import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mqzvdzyozthcmlezjkyh.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xenZkenlvenRoY21sZXpqa3loIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTc5OTM3OCwiZXhwIjoyMDc1Mzc1Mzc4fQ.rgiB3uq412sD9YpFma0K1lISoxXAwDVUPNrLIm30UG8'

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function setupStorage() {
  try {
    console.log('Setting up storage policies...')

    // Read the SQL file
    const sqlPath = join(process.cwd(), 'supabase', 'migrations', 'setup_storage_policies.sql')
    const sql = readFileSync(sqlPath, 'utf-8')

    // Split by semicolons and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    for (const statement of statements) {
      if (statement.trim()) {
        console.log('Executing:', statement.substring(0, 100) + '...')
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement })
        if (error) {
          console.error('Error:', error)
        } else {
          console.log('✓ Success')
        }
      }
    }

    console.log('\n✓ Storage setup complete!')
  } catch (error) {
    console.error('Setup failed:', error)
    process.exit(1)
  }
}

setupStorage()
