/**
 * Dynamic Demo API Route
 * Serves demo JSON files based on the type parameter
 * No authentication required - public endpoint
 */

import { type NextRequest, NextResponse } from "next/server";
import { notFound } from "@/lib/api/errors";
import chatbotData from "../../../../../public/demo/chatbot.json";
import codegenData from "../../../../../public/demo/codegen.json";
import evaluationsData from "../../../../../public/demo/evaluations.json";
import judgeData from "../../../../../public/demo/judge.json";
import ragData from "../../../../../public/demo/rag.json";
import tracesData from "../../../../../public/demo/traces.json";

const DEMO_DATA_MAP: Record<string, any> = {
  chatbot: chatbotData,
  rag: ragData,
  codegen: codegenData,
  evaluations: evaluationsData,
  traces: tracesData,
  judge: judgeData,
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  const { type } = await params;

  const data = DEMO_DATA_MAP[type];

  if (!data) {
    return notFound(
      "Unknown demo type. Available: chatbot, rag, codegen, evaluations, traces, judge",
    );
  }

  return NextResponse.json(data);
}
