/**
 * AI Quality Score Card Component
 * Displays AI model quality metrics in a visual dashboard
 */

'use client';

import { QualityScore } from '@/lib/ai-quality-score';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle2, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AIQualityScoreCardProps {
  score: QualityScore;
  showShare?: boolean;
  onShare?: () => void;
}

export function AIQualityScoreCard({ score, showShare = false, onShare }: AIQualityScoreCardProps) {
  const getGradeColor = (grade: string) => {
    if (grade.startsWith('A')) return 'text-green-600 dark:text-green-400';
    if (grade.startsWith('B')) return 'text-blue-600 dark:text-blue-400';
    if (grade.startsWith('C')) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreColor = (value: number) => {
    if (value >= 90) return 'bg-green-500';
    if (value >= 70) return 'bg-blue-500';
    if (value >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getTrendColor = (trend: number) => {
    if (trend > 0) return 'text-green-600 dark:text-green-400';
    if (trend < 0) return 'text-red-600 dark:text-red-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl">AI Quality Score</CardTitle>
            <CardDescription>Comprehensive model performance analysis</CardDescription>
          </div>
          {showShare && (
            <Button variant="outline" size="sm" onClick={onShare}>
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Score */}
        <div className="flex items-center justify-between p-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg">
          <div>
            <div className="text-6xl font-bold">{score.overall}</div>
            <div className={`text-3xl font-bold ${getGradeColor(score.grade)}`}>
              {score.grade}
            </div>
          </div>
          {score.trend !== 0 && (
            <div className={`flex items-center gap-2 ${getTrendColor(score.trend)}`}>
              {score.trend > 0 ? (
                <TrendingUp className="h-8 w-8" />
              ) : (
                <TrendingDown className="h-8 w-8" />
              )}
              <span className="text-2xl font-semibold">
                {score.trend > 0 ? '+' : ''}{score.trend}%
              </span>
            </div>
          )}
        </div>

        {/* Metric Breakdown */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Performance Metrics</h3>
          
          <div className="space-y-3">
            <MetricRow
              label="Accuracy"
              value={score.metrics.accuracy}
              icon="🎯"
              description="Correct responses"
            />
            <MetricRow
              label="Safety"
              value={score.metrics.safety}
              icon="🛡️"
              description="Harmful content prevention"
            />
            <MetricRow
              label="Latency"
              value={score.metrics.latency}
              icon="⚡"
              description="Response speed"
            />
            <MetricRow
              label="Cost"
              value={score.metrics.cost}
              icon="💰"
              description="Cost efficiency"
            />
            <MetricRow
              label="Consistency"
              value={score.metrics.consistency}
              icon="📊"
              description="Output reliability"
            />
          </div>
        </div>

        {/* Insights */}
        {score.insights.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-blue-500" />
              Key Insights
            </h3>
            <div className="space-y-2">
              {score.insights.map((insight, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-lg">{insight.split(' ')[0]}</span>
                  <span className="text-muted-foreground">{insight.split(' ').slice(1).join(' ')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {score.recommendations.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              Recommendations
            </h3>
            <div className="space-y-2">
              {score.recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-2 text-sm p-3 bg-muted rounded-md">
                  <span className="text-orange-500">•</span>
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MetricRow({ 
  label, 
  value, 
  icon, 
  description 
}: { 
  label: string; 
  value: number; 
  icon: string;
  description: string;
}) {
  const getColor = (val: number) => {
    if (val >= 90) return 'bg-green-500';
    if (val >= 70) return 'bg-blue-500';
    if (val >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <div>
            <div className="font-medium">{label}</div>
            <div className="text-xs text-muted-foreground">{description}</div>
          </div>
        </div>
        <Badge variant="secondary" className="text-base font-semibold">
          {value}
        </Badge>
      </div>
      <Progress value={value} className={`h-2 ${getColor(value)}`} />
    </div>
  );
}

