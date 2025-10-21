/**
 * Evaluation Templates Page
 * Browse and copy ready-to-use evaluation templates
 */

import { evaluationTemplates, getTemplatesByCategory } from '@/lib/evaluation-templates-library';
import { TemplateCard } from '@/components/template-card';
import { Metadata } from 'next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Copy, Zap, BookOpen } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Evaluation Templates | EvalAI',
  description: 'Ready-to-use evaluation templates for chatbots, RAG systems, code generation, and more. Copy, customize, and run in minutes.',
};

export default function TemplatesPage() {
  const categories = [
    { id: 'all', name: 'All Templates', count: evaluationTemplates.length },
    { id: 'chatbot', name: 'Chatbots', count: getTemplatesByCategory('chatbot').length },
    { id: 'rag', name: 'RAG Systems', count: getTemplatesByCategory('rag').length },
    { id: 'code-gen', name: 'Code Generation', count: getTemplatesByCategory('code-gen').length },
    { id: 'content', name: 'Content', count: getTemplatesByCategory('content').length },
    { id: 'classification', name: 'Classification', count: getTemplatesByCategory('classification').length },
  ];

  return (
    <div className="container mx-auto px-4 py-12 space-y-12">
      {/* Hero */}
      <div className="text-center space-y-4">
        <Badge variant="secondary" className="text-sm">
          {evaluationTemplates.length} Templates
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight">
          Evaluation Templates
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Copy/paste ready templates for common AI evaluation scenarios. Start testing in under 2 minutes.
        </p>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <StatCard
          icon={<Copy className="h-5 w-5" />}
          label="Copy & Run"
          value="2 min"
          description="From template to results"
        />
        <StatCard
          icon={<Zap className="h-5 w-5" />}
          label="Battle-Tested"
          value="1000+"
          description="Production evaluations"
        />
        <StatCard
          icon={<BookOpen className="h-5 w-5" />}
          label="Use Cases"
          value="6+"
          description="Categories covered"
        />
        <StatCard
          icon={<Search className="h-5 w-5" />}
          label="Free Forever"
          value="100%"
          description="All templates free"
        />
      </div>

      {/* Templates */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          {categories.map((cat) => (
            <TabsTrigger key={cat.id} value={cat.id} className="text-xs md:text-sm">
              {cat.name} ({cat.count})
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all" className="mt-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {evaluationTemplates.map((template) => (
              <TemplateCard key={template.id} template={template} />
            ))}
          </div>
        </TabsContent>

        {categories.slice(1).map((cat) => (
          <TabsContent key={cat.id} value={cat.id} className="mt-8">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {getTemplatesByCategory(cat.id as any).map((template) => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* CTA */}
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="py-12">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold">Need a custom template?</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              We can help you create evaluation templates tailored to your specific use case.
            </p>
            <div className="flex gap-4 justify-center">
              <a
                href="/contact"
                className="px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                Contact Us
              </a>
              <a
                href="/documentation"
                className="px-6 py-3 border rounded-md hover:bg-accent"
              >
                View Documentation
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value, description }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  description: string;
}) {
  return (
    <Card>
      <CardContent className="py-6">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-primary/10 rounded-lg">
            {icon}
          </div>
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">{label}</div>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-xs text-muted-foreground">{description}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

