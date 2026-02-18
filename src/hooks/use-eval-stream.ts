// src/hooks/use-eval-stream.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface StreamEvent {
  type: string;
  data: any;
  timestamp: string;
  id?: string;
}

interface UseEvalStreamOptions {
  evaluationId: number;
  enabled?: boolean;
  onEvent?: (event: StreamEvent) => void;
  onError?: (error: Error) => void;
}

interface UseEvalStreamReturn {
  events: StreamEvent[];
  connected: boolean;
  error: Error | null;
  reconnect: () => void;
}

/**
 * EventSource hook for real-time evaluation streaming.
 * Connects to the per-eval SSE endpoint and delivers typed events.
 */
export function useEvalStream({
  evaluationId,
  enabled = true,
  onEvent,
  onError,
}: UseEvalStreamOptions): UseEvalStreamReturn {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (!enabled || !evaluationId) return;

    // Close existing connection
    esRef.current?.close();
    setError(null);

    const es = new EventSource(`/api/stream/${evaluationId}`);
    esRef.current = es;

    es.onopen = () => {
      setConnected(true);
      setError(null);
    };

    es.onmessage = (e) => {
      try {
        const event: StreamEvent = JSON.parse(e.data);
        setEvents((prev) => [...prev.slice(-500), event]); // Keep last 500 events
        onEvent?.(event);
      } catch {
        // Ignore malformed events
      }
    };

    // Listen to typed events
    const eventTypes = [
      "evaluation_started",
      "evaluation_progress",
      "evaluation_completed",
      "evaluation_failed",
      "test_case_started",
      "test_case_completed",
      "test_case_failed",
      "arena_match_started",
      "arena_match_completed",
      "model_response",
      "ping",
    ];

    for (const type of eventTypes) {
      es.addEventListener(type, (e: MessageEvent) => {
        try {
          const event: StreamEvent = {
            type,
            data: JSON.parse(e.data),
            timestamp: new Date().toISOString(),
            id: e.lastEventId,
          };
          setEvents((prev) => [...prev.slice(-500), event]);
          onEvent?.(event);
        } catch {
          // Ignore malformed events
        }
      });
    }

    es.onerror = () => {
      setConnected(false);
      const err = new Error("SSE connection lost");
      setError(err);
      onError?.(err);
      // EventSource auto-reconnects by default
    };
  }, [evaluationId, enabled, onEvent, onError]);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, [connect]);

  return { events, connected, error, reconnect: connect };
}
