// src/lib/streaming/sse-server.ts
import { logger } from "@/lib/logger";

export interface SSEMessage {
  type: string;
  data: any;
  timestamp: string;
  id?: string;
}

export interface SSEClient {
  id: string;
  response: Response;
  controller: ReadableStreamDefaultController | null;
  organizationId: number;
  userId?: string;
  channels: string[];
  lastPing: number;
}

/**
 * SSE Server
 * Manages Server-Sent Events for real-time streaming.
 * This is the core of the "Terminal UI" viral feature.
 */
export class SSEServer {
  private clients: Map<string, SSEClient> = new Map();
  private channels: Map<string, Set<string>> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startPingInterval();
  }

  /**
   * Add a new SSE client.
   */
  addClient(
    clientId: string,
    response: Response,
    organizationId: number,
    userId?: string,
    channels: string[] = [],
    controller?: ReadableStreamDefaultController,
  ): void {
    const client: SSEClient = {
      id: clientId,
      response,
      controller: controller || null,
      organizationId,
      userId,
      channels,
      lastPing: Date.now(),
    };

    this.clients.set(clientId, client);

    // Add client to channels
    for (const channel of channels) {
      if (!this.channels.has(channel)) {
        this.channels.set(channel, new Set());
      }
      this.channels.get(channel)!.add(clientId);
    }

    logger.info("SSE client connected", { clientId, organizationId, channels });
  }

  /**
   * Remove an SSE client.
   */
  removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Remove from channels
    for (const channel of client.channels) {
      const channelClients = this.channels.get(channel);
      if (channelClients) {
        channelClients.delete(clientId);
        if (channelClients.size === 0) {
          this.channels.delete(channel);
        }
      }
    }

    this.clients.delete(clientId);
    logger.info("SSE client disconnected", { clientId });
  }

  /**
   * Subscribe a client to a channel.
   */
  subscribe(clientId: string, channel: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    if (!client.channels.includes(channel)) {
      client.channels.push(channel);
    }

    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Set());
    }
    this.channels.get(channel)!.add(clientId);

    logger.info("Client subscribed to channel", { clientId, channel });
  }

  /**
   * Unsubscribe a client from a channel.
   */
  unsubscribe(clientId: string, channel: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.channels = client.channels.filter((c) => c !== channel);

    const channelClients = this.channels.get(channel);
    if (channelClients) {
      channelClients.delete(clientId);
      if (channelClients.size === 0) {
        this.channels.delete(channel);
      }
    }

    logger.info("Client unsubscribed from channel", { clientId, channel });
  }

  /**
   * Send a message to a specific client.
   */
  sendToClient(clientId: string, message: SSEMessage): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;

    try {
      const data = this.formatMessage(message);
      this.writeToResponse(client.response, data);
      return true;
    } catch (error) {
      logger.error("Failed to send message to client", { clientId, error });
      this.removeClient(clientId);
      return false;
    }
  }

  /**
   * Send a message to all clients in a channel.
   */
  sendToChannel(channel: string, message: SSEMessage): number {
    const channelClients = this.channels.get(channel);
    if (!channelClients) return 0;

    let sentCount = 0;
    const clientsToRemove: string[] = [];

    for (const clientId of channelClients) {
      if (this.sendToClient(clientId, message)) {
        sentCount++;
      } else {
        clientsToRemove.push(clientId);
      }
    }

    // Clean up dead clients
    for (const clientId of clientsToRemove) {
      this.removeClient(clientId);
    }

    return sentCount;
  }

  /**
   * Send a message to all clients in an organization.
   */
  sendToOrganization(organizationId: number, message: SSEMessage): number {
    let sentCount = 0;
    const clientsToRemove: string[] = [];

    for (const [clientId, client] of this.clients) {
      if (client.organizationId === organizationId) {
        if (this.sendToClient(clientId, message)) {
          sentCount++;
        } else {
          clientsToRemove.push(clientId);
        }
      }
    }

    // Clean up dead clients
    for (const clientId of clientsToRemove) {
      this.removeClient(clientId);
    }

    return sentCount;
  }

  /**
   * Send a message to a specific user.
   */
  sendToUser(userId: string, message: SSEMessage): number {
    let sentCount = 0;
    const clientsToRemove: string[] = [];

    for (const [clientId, client] of this.clients) {
      if (client.userId === userId) {
        if (this.sendToClient(clientId, message)) {
          sentCount++;
        } else {
          clientsToRemove.push(clientId);
        }
      }
    }

    // Clean up dead clients
    for (const clientId of clientsToRemove) {
      this.removeClient(clientId);
    }

    return sentCount;
  }

  /**
   * Get client information.
   */
  getClient(clientId: string): SSEClient | undefined {
    return this.clients.get(clientId);
  }

  /**
   * Get all clients for an organization.
   */
  getOrganizationClients(organizationId: number): SSEClient[] {
    return Array.from(this.clients.values()).filter(
      (client) => client.organizationId === organizationId,
    );
  }

  /**
   * Get channel statistics.
   */
  getChannelStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const [channel, clients] of this.channels) {
      stats[channel] = clients.size;
    }
    return stats;
  }

  /**
   * Get server statistics.
   */
  getServerStats(): {
    totalClients: number;
    totalChannels: number;
    organizationStats: Record<number, number>;
  } {
    const organizationStats: Record<number, number> = {};
    for (const client of this.clients.values()) {
      organizationStats[client.organizationId] =
        (organizationStats[client.organizationId] || 0) + 1;
    }

    return {
      totalClients: this.clients.size,
      totalChannels: this.channels.size,
      organizationStats,
    };
  }

  /**
   * Format SSE message.
   */
  private formatMessage(message: SSEMessage): string {
    const lines = [
      `id: ${message.id || Date.now()}`,
      `event: ${message.type}`,
      `data: ${JSON.stringify(message.data)}`,
      `timestamp: ${message.timestamp}`,
      "",
      "",
    ];
    return lines.join("\n");
  }

  /**
   * Write data to SSE response.
   */
  private encoder = new TextEncoder();

  private writeToResponse(_response: Response, data: string): void {
    // Find the client that owns this response and write via its controller
    for (const client of this.clients.values()) {
      if (client.response === _response && client.controller) {
        try {
          client.controller.enqueue(this.encoder.encode(data));
        } catch {
          // Controller may be closed; client will be cleaned up on next ping
        }
        return;
      }
    }
    logger.debug("SSE message (no active controller)", { data: data.substring(0, 100) });
  }

  /**
   * Start ping interval to keep connections alive.
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      const now = Date.now();
      const clientsToRemove: string[] = [];

      for (const [clientId, client] of this.clients) {
        // Remove clients that haven't responded to pings
        if (now - client.lastPing > 30000) {
          // 30 seconds timeout
          clientsToRemove.push(clientId);
        } else {
          // Send ping
          this.sendToClient(clientId, {
            type: "ping",
            data: { timestamp: now },
            timestamp: new Date(now).toISOString(),
          });
        }
      }

      // Clean up dead clients
      for (const clientId of clientsToRemove) {
        this.removeClient(clientId);
      }
    }, 15000); // Ping every 15 seconds
  }

  /**
   * Stop ping interval.
   */
  stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Clean up all connections.
   */
  cleanup(): void {
    this.stopPingInterval();
    this.clients.clear();
    this.channels.clear();
    logger.info("SSE server cleaned up");
  }
}

// Global SSE server instance
export const sseServer = new SSEServer();

/**
 * SSE Message Types
 */
export const SSE_MESSAGE_TYPES = {
  // Evaluation events
  EVALUATION_STARTED: "evaluation_started",
  EVALUATION_PROGRESS: "evaluation_progress",
  EVALUATION_COMPLETED: "evaluation_completed",
  EVALUATION_FAILED: "evaluation_failed",
  TEST_CASE_STARTED: "test_case_started",
  TEST_CASE_COMPLETED: "test_case_completed",
  TEST_CASE_FAILED: "test_case_failed",

  // Arena events
  ARENA_MATCH_STARTED: "arena_match_started",
  ARENA_MATCH_PROGRESS: "arena_match_progress",
  ARENA_MATCH_COMPLETED: "arena_match_completed",
  MODEL_RESPONSE: "model_response",

  // System events
  PING: "ping",
  CONNECTION_ESTABLISHED: "connection_established",
  ERROR: "error",
  NOTIFICATION: "notification",

  // Real-time updates
  LEADERBOARD_UPDATE: "leaderboard_update",
  REPORT_CARD_UPDATE: "report_card_update",
  SHADOW_EVAL_UPDATE: "shadow_eval_update",
} as const;

/**
 * Create SSE message helpers
 */
export const createSSEMessage = (type: string, data: any, id?: string): SSEMessage => ({
  type,
  data,
  timestamp: new Date().toISOString(),
  id,
});

/**
 * Evaluation-specific message creators
 */
export const createEvaluationStartedMessage = (
  evaluationId: number,
  evaluationName: string,
): SSEMessage =>
  createSSEMessage(SSE_MESSAGE_TYPES.EVALUATION_STARTED, {
    evaluationId,
    evaluationName,
  });

export const createEvaluationProgressMessage = (
  evaluationId: number,
  progress: number,
  currentTest: string,
  totalTests: number,
): SSEMessage =>
  createSSEMessage(SSE_MESSAGE_TYPES.EVALUATION_PROGRESS, {
    evaluationId,
    progress,
    currentTest,
    totalTests,
  });

export const createEvaluationCompletedMessage = (evaluationId: number, results: any): SSEMessage =>
  createSSEMessage(SSE_MESSAGE_TYPES.EVALUATION_COMPLETED, {
    evaluationId,
    results,
  });

export const createTestCaseStartedMessage = (
  evaluationId: number,
  testCaseId: number,
  testCaseName: string,
): SSEMessage =>
  createSSEMessage(SSE_MESSAGE_TYPES.TEST_CASE_STARTED, {
    evaluationId,
    testCaseId,
    testCaseName,
  });

export const createTestCaseCompletedMessage = (
  evaluationId: number,
  testCaseId: number,
  score: number,
  passed: boolean,
): SSEMessage =>
  createSSEMessage(SSE_MESSAGE_TYPES.TEST_CASE_COMPLETED, {
    evaluationId,
    testCaseId,
    score,
    passed,
  });

export const createTestCaseFailedMessage = (
  evaluationId: number,
  testCaseId: number,
  error: string,
): SSEMessage =>
  createSSEMessage(SSE_MESSAGE_TYPES.TEST_CASE_FAILED, {
    evaluationId,
    testCaseId,
    error,
  });

/**
 * Arena-specific message creators
 */
export const createArenaMatchStartedMessage = (matchId: number, models: string[]): SSEMessage =>
  createSSEMessage(SSE_MESSAGE_TYPES.ARENA_MATCH_STARTED, {
    matchId,
    models,
  });

export const createModelResponseMessage = (
  matchId: number,
  modelId: string,
  response: string,
  score: number,
): SSEMessage =>
  createSSEMessage(SSE_MESSAGE_TYPES.MODEL_RESPONSE, {
    matchId,
    modelId,
    response,
    score,
  });

/**
 * System message creators
 */
export const createNotificationMessage = (
  title: string,
  message: string,
  type: "info" | "success" | "warning" | "error" = "info",
): SSEMessage =>
  createSSEMessage(SSE_MESSAGE_TYPES.NOTIFICATION, {
    title,
    message,
    type,
  });

export const createErrorMessage = (error: string, context?: any): SSEMessage =>
  createSSEMessage(SSE_MESSAGE_TYPES.ERROR, {
    error,
    context,
  });
