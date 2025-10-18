import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export async function onRequestError(error: unknown, request: NextRequest) {
  const err = error instanceof Error ? error : new Error(String(error));
  
  // Capture unhandled request errors with Sentry
  Sentry.captureException(err, {
    tags: {
      type: 'request_error',
      runtime: process.env.NEXT_RUNTIME || 'unknown',
      url: request.url
    },
    extra: {
      source: 'instrumentation',
      timestamp: new Date().toISOString(),
      method: request.method,
      headers: Object.fromEntries(request.headers.entries())
    }
  });
  
  // In production, return a generic error response
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
  
  // In development, include the error stack for debugging
  return NextResponse.json(
    { 
      error: 'Internal Server Error',
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    },
    { status: 500 }
  );
}

// Add type safety for the module
declare global {
  // eslint-disable-next-line no-var
  var __NEXT_USE_INSTRUMENTATION__: boolean | undefined;
}

// Enable instrumentation in development
if (global.__NEXT_USE_INSTRUMENTATION__ === undefined) {
  global.__NEXT_USE_INSTRUMENTATION__ = true;
}