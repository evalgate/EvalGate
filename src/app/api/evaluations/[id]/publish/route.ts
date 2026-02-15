import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { randomBytes } from 'crypto'

function generateShareId(): string {
  return randomBytes(5).toString('hex')
}

/**
 * POST /api/evaluations/[id]/publish
 * Publish an evaluation as a public demo
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    
    const {
      exportData,
      customShareId,
    } = body
    
    if (!exportData) {
      return NextResponse.json(
        { error: 'Export data is required' },
        { status: 400 }
      )
    }
    
    // Generate or use custom share ID
    const shareId = customShareId || generateShareId()
    
    // Validate share ID format
    if (!/^[a-z0-9-]+$/.test(shareId)) {
      return NextResponse.json(
        { error: 'Share ID must contain only lowercase letters, numbers, and hyphens' },
        { status: 400 }
      )
    }
    
    // Define public exports directory
    // NOTE: Vercel has a read-only filesystem, so file writes only work locally or on self-hosted
    const publicDir = join(process.cwd(), 'public', 'exports', 'public')
    
    // Ensure directory exists
    try {
      if (!existsSync(publicDir)) {
        await mkdir(publicDir, { recursive: true })
      }
    } catch (fsError) {
      console.error('Filesystem write not supported (likely serverless):', fsError)
      return NextResponse.json(
        { error: 'Publishing is not available in serverless environments. Use self-hosted deployment or database-backed storage.' },
        { status: 501 }
      )
    }
    
    // Check if share ID already exists
    const filePath = join(publicDir, `${shareId}.json`)
    if (existsSync(filePath) && customShareId) {
      return NextResponse.json(
        { error: 'This share ID is already taken. Please choose another.' },
        { status: 409 }
      )
    }
    
    // Add metadata to export data
    const publishedData = {
      ...exportData,
      published_at: new Date().toISOString(),
      share_id: shareId,
      public: true,
    }
    
    // Write the file
    await writeFile(filePath, JSON.stringify(publishedData, null, 2), 'utf-8')
    
    // Update the public demos index
    await updatePublicDemosIndex(shareId, publishedData)
    
    return NextResponse.json({
      success: true,
      shareId,
      shareUrl: `${process.env.NEXT_PUBLIC_BASE_URL || ''}/share/${shareId}`,
    })
  } catch (error) {
    console.error('Error publishing demo:', error)
    return NextResponse.json(
      { error: 'Failed to publish demo' },
      { status: 500 }
    )
  }
}

/**
 * Update the public demos index file
 */
async function updatePublicDemosIndex(shareId: string, demoData: any) {
  try {
    const indexPath = join(process.cwd(), 'public', 'exports', 'public', 'index.json')
    
    let index: { demos: any[] } = { demos: [] }
    
    // Read existing index if it exists
    if (existsSync(indexPath)) {
      const { readFile } = await import('fs/promises')
      const content = await readFile(indexPath, 'utf-8')
      index = JSON.parse(content)
    }
    
    // Add or update demo in index
    const demoIndex = index.demos.findIndex(d => d.id === shareId)
    const demoEntry = {
      id: shareId,
      name: demoData.evaluation?.name || 'Untitled Evaluation',
      description: demoData.evaluation?.description || '',
      type: demoData.evaluation?.type || 'unit_test',
      category: demoData.evaluation?.category,
      published_at: demoData.published_at,
      summary: demoData.summary,
    }
    
    if (demoIndex >= 0) {
      index.demos[demoIndex] = demoEntry
    } else {
      index.demos.unshift(demoEntry) // Add to beginning
    }
    
    // Keep only last 100 demos
    index.demos = index.demos.slice(0, 100)
    
    // Write updated index
    await writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8')
  } catch (error) {
    console.error('Error updating demos index:', error)
    // Don't throw - index update is not critical
  }
}

/**
 * DELETE /api/evaluations/[id]/publish
 * Unpublish a demo
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url)
    const shareId = searchParams.get('shareId')
    
    if (!shareId) {
      return NextResponse.json(
        { error: 'Share ID is required' },
        { status: 400 }
      )
    }
    
    const filePath = join(process.cwd(), 'public', 'exports', 'public', `${shareId}.json`)
    
    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Demo not found' },
        { status: 404 }
      )
    }
    
    // Delete the file
    const { unlink } = await import('fs/promises')
    await unlink(filePath)
    
    // Remove from index
    await removeFromPublicDemosIndex(shareId)
    
    return NextResponse.json({
      success: true,
      message: 'Demo unpublished successfully',
    })
  } catch (error) {
    console.error('Error unpublishing demo:', error)
    return NextResponse.json(
      { error: 'Failed to unpublish demo' },
      { status: 500 }
    )
  }
}

async function removeFromPublicDemosIndex(shareId: string) {
  try {
    const indexPath = join(process.cwd(), 'public', 'exports', 'public', 'index.json')
    
    if (!existsSync(indexPath)) return
    
    const { readFile, writeFile } = await import('fs/promises')
    const content = await readFile(indexPath, 'utf-8')
    const index = JSON.parse(content)
    
    index.demos = index.demos.filter((d: any) => d.id !== shareId)
    
    await writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8')
  } catch (error) {
    console.error('Error removing from demos index:', error)
  }
}
