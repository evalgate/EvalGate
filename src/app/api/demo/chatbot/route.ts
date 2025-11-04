/**
 * Demo Chatbot Evaluation API
 * Returns pre-populated chatbot evaluation data
 * No authentication required - public endpoint
 */

import { NextResponse } from 'next/server';
import chatbotData from '@/../../public/demo/chatbot.json';

export const runtime = 'edge';

/**
 * GET /api/demo/chatbot
 * Returns chatbot evaluation demo data
 */
export async function GET() {
  return NextResponse.json(chatbotData);
}
