import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get('authorization')
    const userId = await getUserFromRequest(authHeader || '')

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: project, error } = await supabaseAdmin
      .from('projects')
      .select(`
        *,
        pages (
          id,
          page_index,
          width,
          height,
          original_blob_url,
          processed_blob_url,
          thumbnail_blob_url
        )
      `)
      .eq('id', params.id)
      .eq('owner_id', userId)
      .single()

    if (error || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json(project)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get('authorization')
    const userId = await getUserFromRequest(authHeader || '')

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title, content_rating, status } = body

    const updateData: any = {}
    if (title) updateData.title = title
    if (content_rating) updateData.content_rating = content_rating
    if (status) updateData.status = status

    const { data: project, error } = await supabaseAdmin
      .from('projects')
      // @ts-expect-error - Supabase type inference issue
      .update(updateData)
      .eq('id', params.id)
      .eq('owner_id', userId)
      .select()
      .single()

    if (error || !project) {
      return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
    }

    return NextResponse.json(project)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get('authorization')
    const userId = await getUserFromRequest(authHeader || '')

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabaseAdmin
      .from('projects')
      .delete()
      .eq('id', params.id)
      .eq('owner_id', userId)

    if (error) {
      return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 })
  }
}
