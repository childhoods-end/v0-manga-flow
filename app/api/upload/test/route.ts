import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    console.log('Test upload API called')

    // Test 1: Can we read the request?
    const contentType = request.headers.get('content-type')
    console.log('Content-Type:', contentType)

    // Test 2: Can we parse formData?
    const formData = await request.formData()
    const title = formData.get('title')
    console.log('Title:', title)

    // Test 3: Count files
    const files = formData.getAll('files')
    console.log('Files count:', files.length)

    return NextResponse.json({
      success: true,
      message: 'Test upload API working',
      title,
      filesCount: files.length
    })
  } catch (error) {
    console.error('Test upload error:', error)
    return NextResponse.json({
      error: 'Test failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
