/**
 * Demo RAG Hallucination Detection API
 * Returns pre-populated RAG evaluation data
 * No authentication required - public endpoint
 */

import { NextResponse } from 'next/server';
import ragData from '@/../../public/demo/rag.json';

export const runtime = 'edge';

/**
 * GET /api/demo/rag
 * Returns RAG hallucination detection demo data
 */
export async function GET() {
  return NextResponse.json(ragData);
}
