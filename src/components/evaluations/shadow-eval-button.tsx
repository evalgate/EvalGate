// src/components/evaluations/shadow-eval-button.tsx
"use client";

import { format } from "date-fns";
import { CalendarDays, Filter, Loader2, Play, TrendingUp } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface ShadowEvalButtonProps {
  evaluationId: number;
  onShadowEvalCreated?: (shadowEvalId: number) => void;
}

interface TraceFilters {
  status: string[];
  durationMin?: number;
  durationMax?: number;
}

export function ShadowEvalButton({ evaluationId, onShadowEvalCreated }: ShadowEvalButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTraces, setSelectedTraces] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: undefined,
    to: undefined,
  });
  const [filters, setFilters] = useState<TraceFilters>({
    status: [],
    durationMin: undefined,
    durationMax: undefined,
  });
  const [availableTraces, setAvailableTraces] = useState<
    Array<{
      id: string;
      traceId: string;
      status: string;
      duration: number;
      createdAt: string;
    }>
  >([]);

  const handleRunShadowEval = async () => {
    if (selectedTraces.length === 0) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/shadow-evals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          evaluationId,
          traceIds: selectedTraces,
          dateRange:
            dateRange.from && dateRange.to
              ? {
                  start: dateRange.from.toISOString(),
                  end: dateRange.to.toISOString(),
                }
              : undefined,
          filters: Object.keys(filters).length > 0 ? filters : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create shadow evaluation");
      }

      const result = await response.json();
      onShadowEvalCreated?.(result.id);
      setIsOpen(false);

      // Reset state
      setSelectedTraces([]);
      setDateRange({ from: undefined, to: undefined });
      setFilters({ status: [] });
    } catch (error: any) {
      console.error("Shadow eval error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAvailableTraces = async () => {
    try {
      // This would load traces from your traces API
      // For now, we'll use mock data
      const mockTraces = [
        {
          id: "1",
          traceId: "trace_123",
          status: "completed",
          duration: 1500,
          createdAt: "2024-01-15T10:30:00Z",
        },
        {
          id: "2",
          traceId: "trace_456",
          status: "completed",
          duration: 2300,
          createdAt: "2024-01-15T11:15:00Z",
        },
        {
          id: "3",
          traceId: "trace_789",
          status: "failed",
          duration: 800,
          createdAt: "2024-01-15T12:00:00Z",
        },
        {
          id: "4",
          traceId: "trace_012",
          status: "completed",
          duration: 1800,
          createdAt: "2024-01-15T13:45:00Z",
        },
        {
          id: "5",
          traceId: "trace_345",
          status: "completed",
          duration: 1200,
          createdAt: "2024-01-15T14:30:00Z",
        },
      ];
      setAvailableTraces(mockTraces);
    } catch (error) {
      console.error("Failed to load traces:", error);
    }
  };

  const filteredTraces = availableTraces.filter((trace) => {
    // Status filter
    if (filters.status.length > 0 && !filters.status.includes(trace.status)) {
      return false;
    }

    // Duration filter
    if (filters.durationMin !== undefined && trace.duration < filters.durationMin) {
      return false;
    }
    if (filters.durationMax !== undefined && trace.duration > filters.durationMax) {
      return false;
    }

    // Date range filter
    if (dateRange.from && new Date(trace.createdAt) < dateRange.from) {
      return false;
    }
    if (dateRange.to && new Date(trace.createdAt) > dateRange.to) {
      return false;
    }

    return true;
  });

  const toggleTraceSelection = (traceId: string) => {
    setSelectedTraces((prev) =>
      prev.includes(traceId) ? prev.filter((id) => id !== traceId) : [...prev, traceId],
    );
  };

  const toggleStatusFilter = (status: string) => {
    setFilters((prev) => ({
      ...prev,
      status: prev.status.includes(status)
        ? prev.status.filter((s) => s !== status)
        : [...prev.status, status],
    }));
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" onClick={loadAvailableTraces}>
          <TrendingUp className="h-4 w-4" />
          Run against Production Logs
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[600px] p-6" align="start">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">Shadow Evaluation</h3>
            <Badge variant="secondary">Beta</Badge>
          </div>

          <p className="text-sm text-muted-foreground">
            Compare your current prompt against production traces to measure performance
            improvements.
          </p>

          {/* Date Range Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Date Range
            </label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal",
                      !dateRange.from && "text-muted-foreground",
                    )}
                  >
                    {dateRange.from ? format(dateRange.from, "MMM dd, yyyy") : "Start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateRange.from}
                    onSelect={(date) => setDateRange((prev) => ({ ...prev, from: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal",
                      !dateRange.to && "text-muted-foreground",
                    )}
                  >
                    {dateRange.to ? format(dateRange.to, "MMM dd, yyyy") : "End date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateRange.to}
                    onSelect={(date) => setDateRange((prev) => ({ ...prev, to: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Status Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Status Filter
            </label>
            <div className="flex gap-3">
              {["completed", "failed", "running"].map((status) => (
                <div key={status} className="flex items-center space-x-2">
                  <Checkbox
                    id={status}
                    checked={filters.status.includes(status)}
                    onCheckedChange={() => toggleStatusFilter(status)}
                  />
                  <label
                    htmlFor={status}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {status}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Duration Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Duration (ms)</label>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Min"
                className="flex h-10 w-24 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={filters.durationMin || ""}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    durationMin: e.target.value ? parseInt(e.target.value, 10) : undefined,
                  }))
                }
              />
              <span className="text-sm text-muted-foreground">to</span>
              <input
                type="number"
                placeholder="Max"
                className="flex h-10 w-24 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={filters.durationMax || ""}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    durationMax: e.target.value ? parseInt(e.target.value, 10) : undefined,
                  }))
                }
              />
            </div>
          </div>

          {/* Available Traces */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                Production Traces ({filteredTraces.length})
              </label>
              {selectedTraces.length > 0 && (
                <Badge variant="secondary">{selectedTraces.length} selected</Badge>
              )}
            </div>

            <div className="max-h-40 overflow-y-auto border rounded-md">
              {filteredTraces.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No traces found matching your criteria
                </div>
              ) : (
                <div className="divide-y">
                  {filteredTraces.map((trace) => (
                    <div
                      key={trace.id}
                      className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer"
                      onClick={() => toggleTraceSelection(trace.traceId)}
                    >
                      <Checkbox checked={selectedTraces.includes(trace.traceId)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{trace.traceId}</span>
                          <Badge
                            variant={
                              trace.status === "completed"
                                ? "default"
                                : trace.status === "failed"
                                  ? "destructive"
                                  : "secondary"
                            }
                            className="text-xs"
                          >
                            {trace.status}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {trace.duration}ms • {new Date(trace.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              onClick={handleRunShadowEval}
              disabled={selectedTraces.length === 0 || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Run Shadow Eval ({selectedTraces.length} traces)
                </>
              )}
            </Button>
          </div>

          {selectedTraces.length === 0 && (
            <Alert>
              <AlertDescription>
                Select at least one production trace to run shadow evaluation.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
