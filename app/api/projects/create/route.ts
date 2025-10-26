import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, sourceLang, targetLang, contentRating, totalPages } = body

    if (!title || totalPages === undefined) {
      return NextResponse.json(
        { error: 'Title and totalPages are required' },
        { status: 400 }
      )
    }

    // For now, use demo user (in production, get from auth)
    const demoUserId = '00000000-0000-0000-0000-000000000000'

    // Create project
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .insert({
        owner_id: demoUserId,
        title,
        content_rating: contentRating || 'general',
        source_language: sourceLang || 'ja',
        target_language: targetLang || 'en',
        total_pages: totalPages,
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

    return NextResponse.json({
      success: true,
      projectId: project.id,
    })
  } catch (error) {
    console.error('Create project failed:', error)
    return NextResponse.json(
      {
        error: 'Create project failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
