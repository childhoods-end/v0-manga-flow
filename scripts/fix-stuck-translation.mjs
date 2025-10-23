import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fixStuckTranslation(projectId) {
  console.log(`\n🔍 Diagnosing project: ${projectId}\n`)

  // 1. Get project info
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()

  if (!project) {
    console.error('❌ Project not found')
    return
  }

  console.log('📦 Project:', {
    title: project.title,
    status: project.status,
    processed_pages: project.processed_pages,
  })

  // 2. Get translation job
  const { data: jobs } = await supabase
    .from('translation_jobs')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  console.log(`\n📋 Found ${jobs?.length || 0} translation jobs:`)
  jobs?.forEach((job, i) => {
    console.log(`  ${i + 1}. Status: ${job.status}, Progress: ${job.progress}%, Current Page: ${job.current_page}/${job.total_pages}`)
    console.log(`     Created: ${job.created_at}, Started: ${job.started_at}`)
  })

  const currentJob = jobs?.[0]

  // 3. Get pages
  const { data: pages } = await supabase
    .from('pages')
    .select('*')
    .eq('project_id', projectId)
    .order('page_index')

  console.log(`\n📄 Found ${pages?.length || 0} pages:`)
  pages?.forEach((page) => {
    const hasProcessed = !!page.processed_blob_url
    const metadata = page.metadata || {}
    const hasError = metadata.page_error || metadata.ocr_error || metadata.render_error || metadata.upload_error

    console.log(`  Page ${page.page_index + 1}: ${hasProcessed ? '✅' : '❌'} ${hasError ? `⚠️ Error` : ''}`)

    if (metadata.stage_timing) {
      console.log(`    Timing: OCR ${metadata.stage_timing.ocr || 0}ms, Translation ${metadata.stage_timing.translation || 0}ms`)
    }

    if (hasError) {
      console.log(`    Error:`, metadata.page_error || metadata.ocr_error || metadata.render_error || metadata.upload_error)
    }
  })

  // 4. Check text blocks for each page
  console.log(`\n📝 Text blocks analysis:`)
  for (const page of pages || []) {
    const { data: blocks } = await supabase
      .from('text_blocks')
      .select('id, status')
      .eq('page_id', page.id)

    console.log(`  Page ${page.page_index + 1}: ${blocks?.length || 0} text blocks`)
  }

  // 5. Determine issue and fix
  console.log(`\n🔧 Diagnosis:`)

  if (!currentJob) {
    console.log('❌ No translation job found. Need to create a new job.')
    console.log('\n💡 Solution: Create a new translation job via API')
    return
  }

  const currentPage = currentJob.current_page || 0
  const totalPages = pages?.length || 0

  if (currentJob.status === 'processing' && currentPage < totalPages) {
    console.log(`⚠️  Job is stuck at page ${currentPage + 1}/${totalPages}`)

    const stuckPage = pages?.[currentPage]
    if (stuckPage) {
      const metadata = stuckPage.metadata || {}

      if (metadata.page_error || metadata.ocr_error) {
        console.log(`\n💡 Page ${currentPage + 1} has an error. Skipping to next page...`)

        // Skip this page and move to next
        const newCurrentPage = currentPage + 1
        const progress = Math.round((newCurrentPage / totalPages) * 100)

        await supabase
          .from('translation_jobs')
          .update({
            current_page: newCurrentPage,
            progress,
          })
          .eq('id', currentJob.id)

        console.log(`✅ Updated job to page ${newCurrentPage}/${totalPages} (${progress}%)`)

        if (newCurrentPage >= totalPages) {
          await supabase
            .from('translation_jobs')
            .update({
              status: 'completed',
              progress: 100,
              completed_at: new Date().toISOString(),
            })
            .eq('id', currentJob.id)

          await supabase
            .from('projects')
            .update({
              status: 'ready',
              processed_pages: totalPages,
            })
            .eq('id', projectId)

          console.log(`✅ Job completed`)
        } else {
          console.log(`\n💡 Next step: Trigger worker to process page ${newCurrentPage + 1}`)
          console.log(`   Run: curl -X POST http://localhost:3000/api/translation-job/trigger/${currentJob.id}`)
        }
      } else {
        console.log(`\n💡 Page ${currentPage + 1} has no error recorded. Worker may need to be triggered.`)
        console.log(`   Run: curl -X POST http://localhost:3000/api/translation-job/trigger/${currentJob.id}`)
      }
    }
  } else if (currentJob.status === 'completed') {
    console.log('✅ Job is already completed')
  } else {
    console.log(`ℹ️  Job status: ${currentJob.status}, page ${currentPage}/${totalPages}`)
  }
}

const projectId = process.argv[2]

if (!projectId) {
  console.error('Usage: node scripts/fix-stuck-translation.mjs <projectId>')
  process.exit(1)
}

fixStuckTranslation(projectId)
  .then(() => console.log('\n✅ Done'))
  .catch(err => {
    console.error('\n❌ Error:', err)
    process.exit(1)
  })
