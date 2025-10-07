import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/supabase/server'
import sharp from 'sharp'
import JSZip from 'jszip'
import logger from '@/lib/logger'
import { PLAN_LIMITS } from '@/lib/constants'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for upload

export async function POST(request: NextRequest) {
  try {
    // Get user from authorization header
    const authHeader = request.headers.get('authorization')
    const userId = await getUserFromRequest(authHeader || '')

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile and check limits
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Check project limit
    const { count } = await supabaseAdmin
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', userId)

    const planLimit = PLAN_LIMITS[(profile as any).plan as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.free

    if (planLimit.maxProjects !== -1 && (count || 0) >= planLimit.maxProjects) {
      return NextResponse.json(
        { error: `Project limit reached for ${(profile as any).plan} plan` },
        { status: 403 }
      )
    }

    // Parse form data
    const formData = await request.formData()
    const title = formData.get('title') as string
    const contentRating = (formData.get('contentRating') as string) || 'general'
    const sourceLang = (formData.get('sourceLang') as string) || 'ja'
    const targetLang = (formData.get('targetLang') as string) || 'en'
    const rightsDeclaration = formData.get('rightsDeclaration') as string
    const files = formData.getAll('files') as File[]

    if (!title || files.length === 0) {
      return NextResponse.json({ error: 'Title and files are required' }, { status: 400 })
    }

    // Create project
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      // @ts-expect-error - Supabase type inference issue
      .insert({
        owner_id: userId,
        title,
        content_rating: contentRating,
        source_language: sourceLang,
        target_language: targetLang,
        rights_declaration: rightsDeclaration,
        total_pages: 0,
        status: 'pending',
      })
      .select()
      .single()

    if (projectError || !project) {
      logger.error({ error: projectError }, 'Failed to create project')
      return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
    }

    // Process files
    const pagePromises = []
    let pageIndex = 0

    for (const file of files) {
      // Check if it's a ZIP file
      if (file.name.endsWith('.zip') || file.name.endsWith('.cbz')) {
        const zipBuffer = Buffer.from(await file.arrayBuffer())
        const zip = await JSZip.loadAsync(zipBuffer)

        // Extract images from zip
        for (const [filename, zipEntry] of Object.entries(zip.files)) {
          const entry = zipEntry as any
          if (entry.dir) continue
          if (!/\.(jpg|jpeg|png|webp)$/i.test(filename)) continue

          const imageBuffer = Buffer.from(await entry.async('arraybuffer'))
          pagePromises.push(processPage(imageBuffer, (project as any).id, pageIndex++, planLimit.maxPagesPerProject))
        }
      } else {
        // Process individual image
        const imageBuffer = Buffer.from(await file.arrayBuffer())
        pagePromises.push(processPage(imageBuffer, (project as any).id, pageIndex++, planLimit.maxPagesPerProject))
      }
    }

    // Wait for all pages to be processed
    const pages = await Promise.all(pagePromises)
    const successfulPages = pages.filter(p => p !== null)

    // Update project with page count
    await supabaseAdmin
      .from('projects')
      // @ts-expect-error - Supabase type inference issue
      .update({
        total_pages: successfulPages.length,
        status: 'processing',
      })
      .eq('id', (project as any).id)

    // Create OCR jobs for each page
    for (const page of successfulPages) {
      await supabaseAdmin
        .from('jobs')
        // @ts-expect-error - Supabase type inference issue
        .insert({
          project_id: (project as any).id,
          job_type: 'ocr',
          state: 'pending',
          metadata: { page_id: (page as any).id },
        })
    }

    logger.info({ projectId: (project as any).id, pageCount: successfulPages.length }, 'Upload completed')

    return NextResponse.json({
      projectId: (project as any).id,
      pageCount: successfulPages.length,
    })
  } catch (error) {
    logger.error({ error }, 'Upload failed')
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}

async function processPage(
  imageBuffer: Buffer,
  projectId: string,
  pageIndex: number,
  maxPages: number
): Promise<any> {
  try {
    // Check page limit
    if (maxPages !== -1 && pageIndex >= maxPages) {
      logger.warn({ pageIndex, maxPages }, 'Page limit reached, skipping')
      return null
    }

    // Get image dimensions
    const metadata = await sharp(imageBuffer).metadata()
    const width = metadata.width!
    const height = metadata.height!

    // Upload to Vercel Blob
    // @ts-expect-error - Vercel Blob type compatibility
    const blob = await put(`originals/${projectId}/${pageIndex}.${metadata.format || 'png'}`, imageBuffer, {
      access: 'public',
    })

    // Insert page record
    const { data: page, error } = await supabaseAdmin
      .from('pages')
      // @ts-expect-error - Supabase type inference issue
      .insert({
        project_id: projectId,
        page_index: pageIndex,
        width,
        height,
        original_blob_url: blob.url,
      })
      .select()
      .single()

    if (error) {
      logger.error({ error, pageIndex }, 'Failed to insert page')
      return null
    }

    return page
  } catch (error) {
    logger.error({ error, pageIndex }, 'Failed to process page')
    return null
  }
}
