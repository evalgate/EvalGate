/**
 * Demo Code Generation Quality API
 * Returns pre-populated code generation evaluation data
 * No authentication required - public endpoint
 */

import { NextResponse } from 'next/server';
import codegenData from '@/../../public/demo/codegen.json';

export const runtime = 'edge';

/**
 * GET /api/demo/codegen
 * Returns code generation quality demo data
 */
export async function GET() {
  return NextResponse.json(codegenData);
}
