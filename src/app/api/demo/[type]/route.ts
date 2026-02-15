/**
 * Dynamic Demo API Route
 * Serves demo JSON files based on the type parameter
 * No authentication required - public endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import chatbotData from '../../../../../public/demo/chatbot.json';
import ragData from '../../../../../public/demo/rag.json';
import codegenData from '../../../../../public/demo/codegen.json';
import evaluationsData from '../../../../../public/demo/evaluations.json';
import tracesData from '../../../../../public/demo/traces.json';
import judgeData from '../../../../../public/demo/judge.json';

const DEMO_DATA_MAP: Record<string, any> = {
  chatbot: chatbotData,
  rag: ragData,
  codegen: codegenData,
  evaluations: evaluationsData,
  traces: tracesData,
  judge: judgeData,
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params;
  
  const data = DEMO_DATA_MAP[type];
  
  if (!data) {
    return NextResponse.json(
      { error: 'Unknown demo type. Available: chatbot, rag, codegen, evaluations, traces, judge' },
      { status: 404 }
    );
  }
  
  return NextResponse.json(data);
}
