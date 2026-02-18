"use client";

import { Clock, Loader2, Swords, Trophy, Zap } from "lucide-react";
// src/components/arena/battle-arena.tsx
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ModelResponse {
  modelId: string;
  output: string;
  latencyMs: number;
  tokenCount: number;
  cost: number;
  error?: string;
}

interface ArenaResult {
  matchId: number;
  winner: { modelId: string; label: string };
  responses: ModelResponse[];
  scores: Record<string, number>;
}

const AVAILABLE_MODELS = [
  { id: "gpt-4o", label: "GPT-4o" },
  { id: "gpt-4o-mini", label: "GPT-4o Mini" },
  { id: "gpt-4-turbo", label: "GPT-4 Turbo" },
  { id: "claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
  { id: "claude-3-opus", label: "Claude 3 Opus" },
  { id: "claude-3-haiku", label: "Claude 3 Haiku" },
];

export function BattleArena() {
  const [prompt, setPrompt] = useState("");
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ArenaResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleModel = (id: string) => {
    setSelectedModels((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  };

  const runBattle = async () => {
    if (!prompt.trim() || selectedModels.length < 2) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/arena/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, models: selectedModels }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Swords className="h-6 w-6 text-orange-500" />
        <h2 className="text-xl font-bold">LLM Battle Arena</h2>
      </div>

      {/* Prompt Input */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="pt-6">
          <textarea
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-sm text-white placeholder-zinc-500 min-h-[100px] focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            placeholder="Enter a prompt to test across models..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Model Selection */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-sm text-zinc-400">Select Models (min 2)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_MODELS.map((model) => (
              <Badge
                key={model.id}
                variant={selectedModels.includes(model.id) ? "default" : "outline"}
                className={`cursor-pointer transition-colors ${
                  selectedModels.includes(model.id)
                    ? "bg-orange-500/20 text-orange-400 border-orange-500/40"
                    : "text-zinc-400 hover:bg-zinc-800"
                }`}
                onClick={() => toggleModel(model.id)}
              >
                {model.label}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Run Button */}
      <Button
        onClick={runBattle}
        disabled={loading || !prompt.trim() || selectedModels.length < 2}
        className="w-full bg-orange-600 hover:bg-orange-700 text-white"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Running Battle...
          </>
        ) : (
          <>
            <Swords className="h-4 w-4 mr-2" /> Start Battle
          </>
        )}
      </Button>

      {/* Error */}
      {error && (
        <Card className="bg-red-500/10 border-red-500/30">
          <CardContent className="pt-4 text-red-400 text-sm">{error}</CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Winner Banner */}
          <Card className="bg-yellow-500/10 border-yellow-500/30">
            <CardContent className="pt-6 flex items-center gap-3">
              <Trophy className="h-8 w-8 text-yellow-500" />
              <div>
                <div className="text-lg font-bold text-yellow-400">{result.winner.label} wins!</div>
                <div className="text-xs text-zinc-400">Match #{result.matchId}</div>
              </div>
            </CardContent>
          </Card>

          {/* Model Responses */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {result.responses.map((resp) => {
              const isWinner = resp.modelId === result.winner.modelId;
              return (
                <Card
                  key={resp.modelId}
                  className={`border ${isWinner ? "border-yellow-500/40 bg-yellow-500/5" : "border-zinc-800 bg-zinc-900/50"}`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">
                        {resp.modelId}
                        {isWinner && <Trophy className="inline h-3 w-3 ml-1 text-yellow-500" />}
                      </CardTitle>
                      <Badge variant="outline" className="text-xs">
                        {result.scores[resp.modelId] ?? 0}/100
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {resp.error ? (
                      <div className="text-red-400 text-sm">{resp.error}</div>
                    ) : (
                      <div className="text-sm text-zinc-300 whitespace-pre-wrap max-h-60 overflow-y-auto">
                        {resp.output}
                      </div>
                    )}
                    <div className="flex gap-4 mt-3 text-xs text-zinc-500">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {resp.latencyMs}ms
                      </span>
                      <span className="flex items-center gap-1">
                        <Zap className="h-3 w-3" /> {resp.tokenCount} tokens
                      </span>
                      <span>${resp.cost.toFixed(4)}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
