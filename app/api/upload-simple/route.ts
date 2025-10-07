import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import sharp from 'sharp'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    console.log('Upload API called')

    // Parse form data
    const formData = await request.formData()
    const title = formData.get('title') as string
    const sourceLang = (formData.get('sourceLang') as string) || 'ja'
    const targetLang = (formData.get('targetLang') as string) || 'en'
    const contentRating = (formData.get('contentRating') as string) || 'general'
    const files = formData.getAll('files') as File[]

    console.log('Received:', { title, filesCount: files.length })

    if (!title || files.length === 0) {
      return NextResponse.json(
        { error: 'Title and files are required' },
        { status: 400 }
      )
    }

    // For now, skip user authentication and use a demo user
    // In production, you should properly authenticate users
    const demoUserId = 'demo-user-id'

    // Check if profile exists, if not create one
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', demoUserId)
      .single()

    if (!profile) {
      // Create demo profile
      await supabaseAdmin.from('profiles').insert({
        id: demoUserId,
        email: 'demo@example.com',
        role: 'user',
        plan: 'free',
      })
    }

    // Create project
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .insert({
        owner_id: demoUserId,
        title,
        content_rating: contentRating,
        source_language: sourceLang,
        target_language: targetLang,
        total_pages: 0,
        status: 'pending',
      })
      .select()
      .single()

    if (projectError || !project) {
      console.error('Failed to create project:', projectError)
      return NextResponse.json(
        { error: 'Failed to create project: ' + (projectError?.message || 'Unknown error') },
        { status: 500 }
      )
    }

    console.log('Project created:', project.id)

    // Process files and save locally (since Blob might not be configured)
    const uploadDir = join(process.cwd(), 'public', 'uploads', project.id)

    // Create upload directory if it doesn't exist
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    let pageIndex = 0
    for (const file of files) {
      try {
        const buffer = Buffer.from(await file.arrayBuffer())

        // Get image dimensions
        const metadata = await sharp(buffer).metadata()
        const width = metadata.width || 800
        const height = metadata.height || 1200

        // Save file locally
        const fileName = `page-${pageIndex}.${metadata.format || 'png'}`
        const filePath = join(uploadDir, fileName)
        await writeFile(filePath, buffer)

        // Create page record with local URL
        const localUrl = `/uploads/${project.id}/${fileName}`

        const { error: pageError } = await supabaseAdmin
          .from('pages')
          .insert({
            project_id: project.id,
            page_index: pageIndex,
            width,
            height,
            original_blob_url: localUrl,
          })

        if (pageError) {
          console.error('Failed to insert page:', pageError)
        }

        pageIndex++
      } catch (error) {
        console.error('Failed to process file:', error)
      }
    }

    // Update project with page count
    await supabaseAdmin
      .from('projects')
      .update({
        total_pages: pageIndex,
        status: 'ready', // Skip OCR for demo
      })
      .eq('id', project.id)

    console.log('Upload completed:', { projectId: project.id, pageCount: pageIndex })

    return NextResponse.json({
      success: true,
      projectId: project.id,
      pageCount: pageIndex,
    })
  } catch (error) {
    console.error('Upload failed:', error)
    return NextResponse.json(
      {
        error: 'Upload failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
