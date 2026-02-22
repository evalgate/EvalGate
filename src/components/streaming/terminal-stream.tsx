// src/components/streaming/terminal-stream.tsx
"use client";

import {
  AlertCircle,
  CheckCircle,
  Copy,
  Download,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Square,
  Terminal,
  XCircle,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface TerminalMessage {
  id: string;
  type: string;
  data: unknown;
  timestamp: string;
  level: "info" | "success" | "warning" | "error";
  content: string;
  metadata?: Record<string, unknown>;
}

interface TerminalStreamProps {
  organizationId: number;
  userId?: string;
  channels?: string[];
  height?: string | number;
  maxHeight?: string | number;
  showControls?: boolean;
  autoScroll?: boolean;
  theme?: "dark" | "light" | "auto";
  className?: string;
}

export function TerminalStream({
  organizationId,
  userId,
  channels = ["evaluation", "arena"],
  height = 400,
  maxHeight,
  showControls = true,
  autoScroll = true,
  theme = "dark",
  className,
}: TerminalStreamProps) {
  const [messages, setMessages] = useState<TerminalMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [filter, setFilter] = useState<string>("");
  const [levelFilter, setLevelFilter] = useState<string>("all");

  const eventSourceRef = useRef<EventSource | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const addMessage = useCallback((message: TerminalMessage) => {
    setMessages((prev) => [...prev.slice(-1000), message]);
  }, []);

  const getMessageLevel = useCallback(
    (type: string, _data: unknown): "info" | "success" | "warning" | "error" => {
      if (type.includes("error") || type.includes("failed")) return "error";
      if (type.includes("completed") || type.includes("success")) return "success";
      if (type.includes("warning")) return "warning";
      return "info";
    },
    [],
  );

  const formatMessageContent = useCallback((type: string, data: unknown): string => {
    switch (type) {
      case "evaluation_started":
        return `🚀 Evaluation started: ${(data as any).evaluationName}`;
      case "evaluation_progress":
        return `⏳ Progress: ${(data as any).progress}% - ${(data as any).currentTest}`;
      case "evaluation_completed":
        return `✅ Evaluation completed successfully`;
      case "test_case_started":
        return `🧪 Test case: ${(data as any).testCaseName}`;
      case "test_case_completed":
        return `✓ Test case completed (Score: ${(data as any).score})`;
      case "test_case_failed":
        return `✗ Test case failed (Score: ${(data as any).score})`;
      case "arena_match_started":
        return `⚔️ Arena match started: ${(data as any).models?.join(" vs ")}`;
      case "model_response":
        return `🤖 ${(data as any).modelId}: Score ${(data as any).score}`;
      case "arena_match_completed":
        return `🏆 Arena match completed`;
      case "notification":
        return `📢 ${(data as any).title}: ${(data as any).message}`;
      case "error":
        return `❌ Error: ${(data as any).error}`;
      case "ping":
        return "💓 Ping";
      default:
        return `📡 ${type}: ${JSON.stringify(data)}`;
    }
  }, []);

  const parseSSEMessage = useCallback(
    (type: string, data: unknown, id?: string): TerminalMessage => {
      const level = getMessageLevel(type, data);
      const content = formatMessageContent(type, data);
      return {
        id: id || `${type}_${Date.now()}`,
        type,
        data,
        timestamp: new Date().toISOString(),
        level,
        content,
        metadata: data as Record<string, unknown>,
      };
    },
    [getMessageLevel, formatMessageContent],
  );

  const shouldIncludeMessage = useCallback(
    (message: TerminalMessage): boolean => {
      if (levelFilter !== "all" && message.level !== levelFilter) return false;
      if (filter && !message.content.toLowerCase().includes(filter.toLowerCase())) return false;
      return true;
    },
    [filter, levelFilter],
  );

  // Connect to SSE stream
  useEffect(() => {
    if (!organizationId) return;

    const clientId = `terminal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const channelsParam = channels.join(",");

    const eventSource = new EventSource(
      `/api/stream?clientId=${clientId}&channels=${channelsParam}`,
    );

    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      addMessage({
        id: "connection",
        type: "connection_established",
        data: { message: "Connected to stream" },
        timestamp: new Date().toISOString(),
        level: "success",
        content: "🔌 Connected to real-time stream",
      });
    };

    eventSource.onmessage = (event) => {
      if (isPaused) return;

      try {
        const data = JSON.parse(event.data);
        const message = parseSSEMessage(event.type, data, event.lastEventId);

        if (shouldIncludeMessage(message)) {
          addMessage(message);
        }
      } catch (error) {
        console.error("Failed to parse SSE message:", error);
      }
    };

    eventSource.onerror = (_error) => {
      setIsConnected(false);
      addMessage({
        id: "error",
        type: "error",
        data: { error: "Connection lost" },
        timestamp: new Date().toISOString(),
        level: "error",
        content: "❌ Connection lost. Attempting to reconnect...",
      });
    };

    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, [organizationId, channels, isPaused, addMessage, parseSSEMessage, shouldIncludeMessage]);

  // Auto-scroll to bottom (messages dependency omitted - scroll on unknown message change)
  useEffect(() => {
    if (autoScroll && scrollAreaRef.current && messagesEndRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [autoScroll]);

  const filteredMessages = messages.filter(shouldIncludeMessage);

  const getLevelIcon = (level: string) => {
    switch (level) {
      case "success":
        return <CheckCircle className="h-3 w-3 text-green-500" />;
      case "error":
        return <XCircle className="h-3 w-3 text-red-500" />;
      case "warning":
        return <AlertCircle className="h-3 w-3 text-yellow-500" />;
      default:
        return <Zap className="h-3 w-3 text-blue-500" />;
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case "success":
        return "text-green-400";
      case "error":
        return "text-red-400";
      case "warning":
        return "text-yellow-400";
      default:
        return "text-gray-400";
    }
  };

  const handleCopy = () => {
    const content = filteredMessages
      .map((msg) => `[${new Date(msg.timestamp).toLocaleTimeString()}] ${msg.content}`)
      .join("\n");

    navigator.clipboard.writeText(content);
  };

  const handleDownload = () => {
    const content = filteredMessages
      .map((msg) => `[${new Date(msg.timestamp).toISOString()}] ${msg.content}`)
      .join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `terminal-log-${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    setMessages([]);
  };

  const terminalHeight = isMaximized ? "80vh" : height;
  const terminalTheme =
    theme === "auto"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;

  return (
    <Card
      className={cn(
        "w-full",
        terminalTheme === "dark" ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200",
        className,
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal
              className={cn(
                "h-5 w-5",
                terminalTheme === "dark" ? "text-gray-400" : "text-gray-600",
              )}
            />
            <CardTitle
              className={cn("text-lg", terminalTheme === "dark" ? "text-white" : "text-gray-900")}
            >
              Terminal Stream
            </CardTitle>
            <div className="flex items-center gap-2">
              <div
                className={cn("w-2 h-2 rounded-full", isConnected ? "bg-green-500" : "bg-red-500")}
              />
              <span
                className={cn(
                  "text-xs",
                  terminalTheme === "dark" ? "text-gray-400" : "text-gray-600",
                )}
              >
                {isConnected ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>

          {showControls && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Filter messages..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className={cn(
                  "px-2 py-1 text-sm rounded border",
                  terminalTheme === "dark"
                    ? "bg-gray-800 border-gray-700 text-gray-300 placeholder-gray-500"
                    : "bg-white border-gray-300 text-gray-900 placeholder-gray-500",
                )}
              />

              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className={cn(
                  "px-2 py-1 text-sm rounded border",
                  terminalTheme === "dark"
                    ? "bg-gray-800 border-gray-700 text-gray-300"
                    : "bg-white border-gray-300 text-gray-900",
                )}
              >
                <option value="all">All</option>
                <option value="info">Info</option>
                <option value="success">Success</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
              </select>

              <Button variant="outline" size="sm" onClick={() => setIsPaused(!isPaused)}>
                {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </Button>

              <Button variant="outline" size="sm" onClick={() => setIsMaximized(!isMaximized)}>
                {isMaximized ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>

              <Button variant="outline" size="sm" onClick={handleCopy}>
                <Copy className="h-4 w-4" />
              </Button>

              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4" />
              </Button>

              <Button variant="outline" size="sm" onClick={handleClear}>
                <Square className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <ScrollArea
          ref={scrollAreaRef}
          className={cn("relative", terminalTheme === "dark" ? "bg-black" : "bg-gray-50")}
          style={{ height: terminalHeight, maxHeight }}
        >
          <div className="p-4 font-mono text-sm space-y-1">
            {filteredMessages.length === 0 ? (
              <div
                className={cn(
                  "text-center py-8",
                  terminalTheme === "dark" ? "text-gray-500" : "text-gray-400",
                )}
              >
                <Terminal className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Waiting for stream messages...</p>
                <p className="text-xs mt-1">{isConnected ? "Connected" : "Connecting..."}</p>
              </div>
            ) : (
              filteredMessages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex items-start gap-2 py-1",
                    terminalTheme === "dark" ? "text-gray-300" : "text-gray-700",
                  )}
                >
                  <span className="text-xs opacity-60 flex-shrink-0 mt-0.5">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </span>
                  <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                    {getLevelIcon(message.level)}
                  </div>
                  <span className={cn("break-words", getLevelColor(message.level))}>
                    {message.content}
                  </span>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
