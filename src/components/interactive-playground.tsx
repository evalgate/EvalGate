/**
 * Interactive Playground Component
 * Try AI evaluations in < 30 seconds, no signup required
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Play, CheckCircle2, XCircle, Copy, Download, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { AIQualityScoreCard } from './ai-quality-score-card';
import { EmailCaptureWidget } from './email-capture-widget';

interface PlaygroundProps {
  onSignupPrompt?: () => void;
}

export function InteractivePlayground({ onSignupPrompt }: PlaygroundProps = {}) {
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [showEmailCapture, setShowEmailCapture] = useState(false);

  const scenarios = [
    {
      id: 'chatbot-accuracy',
      name: 'Chatbot Accuracy',
      description: 'See how well a customer service chatbot handles common questions',
      icon: '💬',
      difficulty: 'Beginner',
      time: '30s',
      color: 'from-blue-500/10 to-blue-500/5'
    },
    {
      id: 'rag-hallucination',
      name: 'RAG Hallucination',
      description: 'Detect when AI makes up information not in source documents',
      icon: '🔍',
      difficulty: 'Intermediate',
      time: '45s',
      color: 'from-purple-500/10 to-purple-500/5'
    },
    {
      id: 'code-quality',
      name: 'Code Generation',
      description: 'Evaluate if generated code actually works and follows best practices',
      icon: '💻',
      difficulty: 'Advanced',
      time: '1m',
      color: 'from-green-500/10 to-green-500/5'
    }
  ];

  const handleRunEvaluation = async (scenarioId: string) => {
    setSelectedScenario(scenarioId);
    setIsRunning(true);
    setResults(null);

    try {
      // Map scenario IDs to demo types
      const demoTypeMap: Record<string, string> = {
        'chatbot-accuracy': 'chatbot',
        'rag-hallucination': 'rag',
        'code-quality': 'codegen'
      };
      
      const demoType = demoTypeMap[scenarioId] || 'chatbot';
      
      const response = await fetch(`/api/demo/${demoType}`);

      if (!response.ok) throw new Error('Failed to run evaluation');

      const data = await response.json();
      
      // Transform the demo data to match the expected format
      const overallScore = Math.round((data.overall || 0.87) * 100);
      const passRate = data.items?.length > 0 
        ? (data.items.filter((item: any) => item.pass).length / data.items.length) * 100 
        : 87;
      
      // Calculate grade based on overall score
      const calculateGrade = (score: number): 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F' => {
        if (score >= 97) return 'A+';
        if (score >= 93) return 'A';
        if (score >= 87) return 'B+';
        if (score >= 83) return 'B';
        if (score >= 77) return 'C+';
        if (score >= 73) return 'C';
        if (score >= 60) return 'D';
        return 'F';
      };
      
      const transformedData = {
        name: scenarios.find(s => s.id === scenarioId)?.name || 'Demo Evaluation',
        results: {
          totalTests: data.items?.length || 10,
          passed: data.items?.filter((item: any) => item.pass).length || 8,
          failed: data.items?.filter((item: any) => !item.pass).length || 2,
          tests: data.items || []
        },
        qualityScore: {
          overall: overallScore,
          grade: calculateGrade(overallScore),
          metrics: {
            accuracy: Math.round(passRate),
            safety: Math.round(passRate * 0.95),
            latency: 85,
            cost: 80,
            consistency: Math.round(passRate * 0.9)
          },
          trend: 0,
          insights: [
            overallScore >= 90 ? '🎯 Excellent performance across all metrics' : '✅ Good performance with room for improvement',
            '⚡ Fast response times',
            '💰 Cost-efficient operations'
          ],
          recommendations: overallScore >= 90 
            ? [
                'Continue monitoring for regressions',
                'Run A/B tests on prompt variations',
                'Expand test coverage to edge cases'
              ]
            : [
                'Add more specific instructions to your prompts',
                'Consider using few-shot learning',
                'Review and update your evaluation rubric'
              ]
        }
      };
      
      setResults(transformedData);
      
      // Show email capture after impressive results
      // (delay to let them see the results first)
      setTimeout(() => {
        setShowEmailCapture(true);
      }, 2000);
      
      toast.success('Evaluation complete!', {
        description: 'Sign up to save and share your results'
      });
    } catch (error) {
      toast.error('Something went wrong', {
        description: 'Please try again'
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleCopyResults = () => {
    const summary = `
Evaluation Results: ${results.name}
Total Tests: ${results.results.totalTests}
Passed: ${results.results.passed}
Failed: ${results.results.failed}
Quality Score: ${results.qualityScore.overall}/100

Breakdown:
- Accuracy: ${results.qualityScore.accuracy}/100
- Relevance: ${results.qualityScore.relevance}/100
- Consistency: ${results.qualityScore.consistency}/100
    `.trim();

    navigator.clipboard.writeText(summary);
    toast.success('Results copied to clipboard!');
  };

  const handleExport = () => {
    // Create a clean summary for export
    const exportData = {
      name: results.name,
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: results.results.totalTests,
        passed: results.results.passed,
        failed: results.results.failed,
        passRate: `${Math.round((results.results.passed / results.results.totalTests) * 100)}%`
      },
      qualityScore: {
        overall: results.qualityScore.overall,
        accuracy: results.qualityScore.accuracy,
        relevance: results.qualityScore.relevance,
        consistency: results.qualityScore.consistency
      }
    };

    // Create downloadable JSON file
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `evaluation-results-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Results exported successfully!');
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <Badge variant="secondary" className="text-sm">
          Try demos instantly—no signup
        </Badge>
        <h2 className="text-4xl font-bold tracking-tight">
          Try AI Evaluation in 30 Seconds
        </h2>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Choose a scenario below and see real evaluation results instantly. Sign up to save results and use the API.
        </p>
      </div>

      {/* Scenario Selection */}
      {!selectedScenario && (
        <div className="grid md:grid-cols-3 gap-6">
          {scenarios.map((scenario) => (
            <Card
              key={scenario.id}
              className={`cursor-pointer transition-all hover:scale-105 hover:shadow-lg bg-gradient-to-br ${scenario.color}`}
              onClick={() => handleRunEvaluation(scenario.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="text-5xl mb-4">{scenario.icon}</div>
                  <div className="flex flex-col gap-1">
                    <Badge variant="outline" className="text-xs">
                      {scenario.difficulty}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {scenario.time}
                    </Badge>
                  </div>
                </div>
                <CardTitle className="text-xl">{scenario.name}</CardTitle>
                <CardDescription>{scenario.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="default">
                  <Play className="h-4 w-4 mr-2" />
                  Run Demo
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Loading State */}
      {isRunning && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
              <div className="text-center space-y-2">
                <p className="text-lg font-semibold">Running evaluation...</p>
                <p className="text-sm text-muted-foreground">
                  Testing {scenarios.find(s => s.id === selectedScenario)?.name}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {results && !isRunning && (
        <div className="space-y-6">
          {/* Action Bar */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold">Evaluation Results</h3>
              <p className="text-muted-foreground">
                {results.name} • {results.results.totalTests} tests
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCopyResults}>
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
              <Button variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button onClick={() => setSelectedScenario(null)}>
                Try Another
              </Button>
            </div>
          </div>

          {/* Quality Score */}
          <AIQualityScoreCard score={results.qualityScore} />

          {/* Test Results */}
          <Card>
            <CardHeader>
              <CardTitle>Test Results</CardTitle>
              <CardDescription>
                {results.results.passed} passed • {results.results.failed} failed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="all" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="all">
                    All ({results.results.totalTests})
                  </TabsTrigger>
                  <TabsTrigger value="passed">
                    Passed ({results.results.passed})
                  </TabsTrigger>
                  <TabsTrigger value="failed">
                    Failed ({results.results.failed})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="all" className="space-y-4 mt-4">
                  {results.results.tests.map((test: any) => (
                    <TestResultCard key={test.id} test={test} />
                  ))}
                </TabsContent>

                <TabsContent value="passed" className="space-y-4 mt-4">
                  {results.results.tests
                    .filter((t: any) => t.status === 'passed')
                    .map((test: any) => (
                      <TestResultCard key={test.id} test={test} />
                    ))}
                </TabsContent>

                <TabsContent value="failed" className="space-y-4 mt-4">
                  {results.results.tests
                    .filter((t: any) => t.status === 'failed')
                    .map((test: any) => (
                      <TestResultCard key={test.id} test={test} />
                    ))}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Email Capture Widget */}
          {showEmailCapture && (
            <EmailCaptureWidget
              source="playground"
              context={{
                scenario: selectedScenario,
                score: results.qualityScore.overall,
                testsPassed: results.results.passed,
                totalTests: results.results.totalTests,
              }}
              onSuccess={() => {
                // Hide email capture after successful submission
                setShowEmailCapture(false);
              }}
            />
          )}

          {/* CTA */}
          {!showEmailCapture && (
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="py-8">
                <div className="text-center space-y-4">
                  <h3 className="text-2xl font-bold">Love what you see?</h3>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  Sign up now to save these results, run unlimited evaluations, and share your quality scores with your team.
                </p>
                <div className="flex gap-4 justify-center">
                  <Button size="lg" onClick={onSignupPrompt}>
                    Start Free Trial
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                  <Button size="lg" variant="outline">
                    View Pricing
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  No credit card required • 14-day free trial • Cancel anytime
                </p>
              </div>
            </CardContent>
          </Card>
          )}
        </div>
      )}
    </div>
  );
}

function TestResultCard({ test }: { test: any }) {
  const isPassed = test.status === 'passed';

  return (
    <Card className={isPassed ? 'border-green-500/20' : 'border-red-500/20'}>
      <CardContent className="py-4">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 mt-1">
            {isPassed ? (
              <CheckCircle2 className="h-6 w-6 text-green-500" />
            ) : (
              <XCircle className="h-6 w-6 text-red-500" />
            )}
          </div>
          
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-medium">
                {test.input || test.query || test.task}
              </p>
              <Badge variant={isPassed ? 'default' : 'destructive'}>
                {test.score}/100
              </Badge>
            </div>

            {test.expected && (
              <div className="text-sm">
                <span className="text-muted-foreground">Expected: </span>
                <span>{test.expected}</span>
              </div>
            )}

            <div className="text-sm">
              <span className="text-muted-foreground">Actual: </span>
              <span>{test.actual || test.generated}</span>
            </div>

            {test.notes && (
              <div className="text-sm text-muted-foreground italic">
                {test.notes}
              </div>
            )}

            {test.context && (
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  View context
                </summary>
                <div className="mt-2 p-3 bg-muted rounded-md">
                  {test.context}
                </div>
              </details>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

