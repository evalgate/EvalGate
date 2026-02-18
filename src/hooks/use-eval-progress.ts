// src/hooks/use-eval-progress.ts
"use client";

import { useCallback, useEffect, useState } from "react";

interface ProgressData {
  runId: number;
  status: string;
  totalCases: number;
  processedCount: number;
  passedCases: number;
  failedCases: number;
  startedAt: string;
  completedAt: string | null;
  percentage: number;
  heartbeat: {
    lastMessage: string;
    count: number;
    entries: Array<{
      timestamp: string;
      processedCount: number;
      message: string;
    }>;
  };
  estimatedTimeRemaining: number | null;
}

interface UseEvalProgressOptions {
  refreshInterval?: number;
  onError?: (error: Error) => void;
  onSuccess?: (data: ProgressData | ProgressData[]) => void;
}

/**
 * Native fetch hook for polling evaluation progress.
 * Provides real-time updates on evaluation run status with automatic retry.
 */
export function useEvalProgress(
  evaluationId: number,
  runId: number,
  options: UseEvalProgressOptions = {},
) {
  const { refreshInterval = 1000, onError, onSuccess } = options;
  const [data, setData] = useState<ProgressData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchProgress = useCallback(async () => {
    try {
      const response = await fetch(`/api/evaluations/${evaluationId}/runs/${runId}/progress`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch progress");
      }

      const progressData = await response.json();
      setData(progressData);
      setError(null);
      onSuccess?.(progressData);
    } catch (err) {
      const error = err as Error;
      setError(error);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [evaluationId, runId, onError, onSuccess]);

  const refresh = useCallback(() => {
    setIsLoading(true);
    fetchProgress();
  }, [fetchProgress]);

  useEffect(() => {
    fetchProgress();

    const interval = setInterval(() => {
      fetchProgress();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [fetchProgress, refreshInterval]);

  /**
   * Check if evaluation is complete
   */
  const isComplete = data?.status === "completed" || data?.status === "completed_with_failures";

  /**
   * Check if evaluation is running
   */
  const isRunning = data?.status === "running";

  /**
   * Check if evaluation failed
   */
  const hasFailed = data?.status === "failed" || data?.status === "cancelled";

  /**
   * Get progress percentage
   */
  const progress = data?.percentage || 0;

  /**
   * Get formatted status text
   */
  const statusText = data?.status
    ? data.status.replace(/_/g, " ").replace(/\b\w/g, (char: string) => char.toUpperCase())
    : "Unknown";

  /**
   * Get formatted time remaining
   */
  const timeRemaining = data?.estimatedTimeRemaining
    ? data.estimatedTimeRemaining > 60
      ? `${Math.floor(data.estimatedTimeRemaining / 60)}m ${Math.round(data.estimatedTimeRemaining % 60)}s`
      : `${Math.round(data.estimatedTimeRemaining)}s`
    : null;

  return {
    data,
    isLoading,
    error,
    refresh,
    isComplete,
    isRunning,
    hasFailed,
    progress,
    statusText,
    timeRemaining,
    lastMessage: data?.heartbeat?.lastMessage || "",
    heartbeatCount: data?.heartbeat?.count || 0,
  };
}

/**
 * Hook for multiple evaluation runs progress
 * Useful for batch operations or dashboard views
 */
export function useMultiEvalProgress(
  evaluationRuns: Array<{ evaluationId: number; runId: number }>,
  options: UseEvalProgressOptions = {},
) {
  const { refreshInterval = 1000, onError, onSuccess } = options;
  const [data, setData] = useState<ProgressData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchProgress = useCallback(async () => {
    try {
      const responses = await Promise.all(
        evaluationRuns.map(async ({ evaluationId, runId }) => {
          const response = await fetch(`/api/evaluations/${evaluationId}/runs/${runId}/progress`, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Failed to fetch progress");
          }

          return response.json();
        }),
      );

      setData(responses as ProgressData[]);
      setError(null);
      onSuccess?.(responses as ProgressData[]);
    } catch (err) {
      const error = err as Error;
      setError(error);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [evaluationRuns, onError, onSuccess]);

  const refresh = useCallback(() => {
    setIsLoading(true);
    fetchProgress();
  }, [fetchProgress]);

  useEffect(() => {
    fetchProgress();

    const interval = setInterval(() => {
      fetchProgress();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [fetchProgress, refreshInterval]);

  return {
    data,
    isLoading,
    error,
    refresh,
    runs: data?.map((progress: ProgressData, index: number) => ({
      ...progress,
      evaluationId: evaluationRuns[index].evaluationId,
      runId: evaluationRuns[index].runId,
      isComplete: progress.status === "completed" || progress.status === "completed_with_failures",
      isRunning: progress.status === "running",
      hasFailed: progress.status === "failed" || progress.status === "cancelled",
      progress: progress.percentage || 0,
    })),
  };
}

/**
 * Hook for waiting for evaluation completion
 * Resolves when evaluation is complete or fails
 */
export function useEvalCompletion(
  evaluationId: number,
  runId: number,
  _options: UseEvalProgressOptions = {},
): Promise<ProgressData> {
  return new Promise((resolve, reject) => {
    const checkCompletion = async () => {
      try {
        const response = await fetch(`/api/evaluations/${evaluationId}/runs/${runId}/progress`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          reject(new Error(errorData.error || "Failed to fetch progress"));
          return;
        }

        const newData: ProgressData = await response.json();

        if (newData.status === "completed" || newData.status === "completed_with_failures") {
          resolve(newData);
        } else if (newData.status === "failed" || newData.status === "cancelled") {
          reject(
            new Error(
              `Evaluation failed: ${newData.status.replace(/_/g, " ").replace(/\b\w/g, (char: string) => char.toUpperCase())}`,
            ),
          );
        } else {
          // Continue polling
          setTimeout(checkCompletion, 1000);
        }
      } catch (err) {
        reject(err);
      }
    };

    checkCompletion();
  });
}
