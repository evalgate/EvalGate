import { NextRequest, NextResponse } from 'next/server';
import { secureRoute, type AuthContext } from '@/lib/api/secure-route';
import { sseServer, createSSEMessage, SSE_MESSAGE_TYPES } from '@/lib/streaming/sse-server';

export const GET = secureRoute(async (request: NextRequest, ctx: AuthContext, params) => {
  const { evalId } = params;
  const channel = `eval:${evalId}`;
  const clientId = `${evalId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const stream = new ReadableStream({
    start(controller) {
      const response = new Response();
      sseServer.addClient(clientId, response, ctx.organizationId, ctx.userId, [channel], controller);

      const msg = createSSEMessage(SSE_MESSAGE_TYPES.CONNECTION_ESTABLISHED, {
        clientId,
        evaluationId: evalId,
      });
      const formatted = `id: ${msg.id || Date.now()}\nevent: ${msg.type}\ndata: ${JSON.stringify(msg.data)}\n\n`;
      controller.enqueue(new TextEncoder().encode(formatted));
    },
    cancel() {
      sseServer.removeClient(clientId);
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
});
