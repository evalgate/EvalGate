/**
 * Template Card Component
 * Displays an evaluation template with copy functionality
 */

'use client';

import { useState } from 'react';
import { EvaluationTemplate } from '@/lib/evaluation-templates-library';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Copy, CheckCircle2, Clock, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';

export function TemplateCard({ template }: { template: EvaluationTemplate }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(template.code);
    setCopied(true);
    toast.success('Code copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-500/10 text-green-700 dark:text-green-400';
      case 'intermediate': return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400';
      case 'advanced': return 'bg-red-500/10 text-red-700 dark:text-red-400';
      default: return '';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'chatbot': return '💬';
      case 'rag': return '🔍';
      case 'code-gen': return '💻';
      case 'content': return '📝';
      case 'classification': return '🎯';
      default: return '📊';
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Card className="cursor-pointer hover:shadow-lg transition-all group">
          <CardHeader>
            <div className="flex items-start justify-between mb-2">
              <div className="text-4xl">{getCategoryIcon(template.category)}</div>
              <div className="flex flex-col gap-1">
                <Badge className={getDifficultyColor(template.difficulty)}>
                  {template.difficulty}
                </Badge>
              </div>
            </div>
            <CardTitle className="group-hover:text-primary transition-colors">
              {template.name}
            </CardTitle>
            <CardDescription className="line-clamp-2">
              {template.description}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {template.estimatedTime}
              </div>
              <div className="flex items-center gap-1">
                <BarChart3 className="h-4 w-4" />
                {template.testCases.length} tests
              </div>
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>

      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl">{template.name}</DialogTitle>
              <DialogDescription className="mt-2">
                {template.description}
              </DialogDescription>
            </div>
            <Badge className={getDifficultyColor(template.difficulty)}>
              {template.difficulty}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{template.estimatedTime} to run</span>
            </div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <span>{template.testCases.length} test cases</span>
            </div>
          </div>

          {/* Code */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Code</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="gap-2"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy Code
                  </>
                )}
              </Button>
            </div>
            <pre className="p-4 bg-muted rounded-lg overflow-x-auto text-sm">
              <code>{template.code}</code>
            </pre>
          </div>

          {/* Test Cases */}
          {template.testCases.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3">Example Test Cases</h3>
              <div className="space-y-3">
                {template.testCases.slice(0, 3).map((testCase, index) => (
                  <Card key={index}>
                    <CardContent className="py-3">
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="font-medium">Input: </span>
                          <span className="text-muted-foreground">{testCase.input}</span>
                        </div>
                        {testCase.expectedOutput && (
                          <div>
                            <span className="font-medium">Expected: </span>
                            <span className="text-muted-foreground">{testCase.expectedOutput}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Rubric */}
          {template.rubric && (
            <div>
              <h3 className="font-semibold mb-2">Evaluation Rubric</h3>
              <Card>
                <CardContent className="py-3">
                  <div className="text-sm whitespace-pre-wrap text-muted-foreground">
                    {template.rubric}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* CTA */}
          <div className="flex gap-3">
            <Button onClick={handleCopy} className="flex-1">
              <Copy className="h-4 w-4 mr-2" />
              Copy & Use Template
            </Button>
            <Button variant="outline" asChild>
              <a href="/playground">Try in Playground</a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

