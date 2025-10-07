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
    // Use a valid UUID format for demo user
    const demoUserId = '00000000-0000-0000-0000-000000000000'

    // Check if profile exists
    let { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', demoUserId)
      .maybeSingle()

    if (!profile) {
      console.log('Creating demo profile...')
      // Create demo profile
      const { data: newProfile, error: insertError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: demoUserId,
          email: 'demo@example.com',
          role: 'user',
          plan: 'free',
          credits: 100,
          age_verified: true,
        })
        .select()
        .single()

      if (insertError) {
        console.error('Failed to create demo profile:', insertError)
        return NextResponse.json(
          {
            error: 'Failed to create demo profile',
            details: insertError.message,
            hint: 'Please check your Supabase database configuration'
          },
          { status: 500 }
        )
      }

      profile = newProfile
      console.log('Demo profile created successfully')
    }

    // Ensure profile exists
    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found and could not be created' },
        { status: 500 }
      )
    }

    console.log('Using profile:', profile.id)

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

    // Check if we're in serverless environment
    const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME

    let pageIndex = 0

    if (isServerless || process.env.USE_SUPABASE_STORAGE === 'true') {
      // Use Supabase Storage for serverless environments
      console.log('Using Supabase Storage (serverless mode)')

      for (const file of files) {
        try {
          const buffer = Buffer.from(await file.arrayBuffer())

          // Get image dimensions
          const metadata = await sharp(buffer).metadata()
          const width = metadata.width || 800
          const height = metadata.height || 1200

          // Upload to Supabase Storage
          const fileName = `${project.id}/page-${pageIndex}.${metadata.format || 'png'}`
          const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
            .from('manga-pages')
            .upload(fileName, buffer, {
              contentType: `image/${metadata.format || 'png'}`,
              upsert: true,
            })

          if (uploadError) {
            console.error('Failed to upload to Supabase Storage:', uploadError)
            throw uploadError
          }

          // Get public URL
          const { data: urlData } = supabaseAdmin.storage
            .from('manga-pages')
            .getPublicUrl(fileName)

          // Create page record
          const { error: pageError } = await supabaseAdmin
            .from('pages')
            .insert({
              project_id: project.id,
              page_index: pageIndex,
              width,
              height,
              original_blob_url: urlData.publicUrl,
            })

          if (pageError) {
            console.error('Failed to insert page:', pageError)
          }

          pageIndex++
        } catch (error) {
          console.error('Failed to process file:', error)
        }
      }
    } else {
      // Use local file system for development
      console.log('Using local file system (development mode)')

      const uploadDir = join(process.cwd(), 'public', 'uploads', project.id)

      // Create upload directory if it doesn't exist
      if (!existsSync(uploadDir)) {
        await mkdir(uploadDir, { recursive: true })
      }

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
