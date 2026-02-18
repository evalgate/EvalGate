/**
 * Evaluation Templates Page
 * Browse and copy ready-to-use evaluation templates
 * Two-tier layout: Featured quick-start templates + full 50+ template catalog
 */

import { Copy, Layers, Search, Zap } from "lucide-react";
import type { Metadata } from "next";
import { CatalogTemplateCard, type CatalogTemplateData } from "@/components/catalog-template-card";
import { TemplateCard } from "@/components/template-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  COMPREHENSIVE_TEMPLATES,
  getTemplatesByCategory as getCatalogTemplatesByCategory,
  TEMPLATE_CATEGORIES,
} from "@/lib/evaluation-templates";
import { evaluationTemplates, getTemplatesByCategory } from "@/lib/evaluation-templates-library";

export const metadata: Metadata = {
  title: "Evaluation Templates | EvalAI",
  description: `${COMPREHENSIVE_TEMPLATES.length + evaluationTemplates.length}+ ready-to-use evaluation templates across 17 categories. Chatbots, RAG, adversarial testing, LLM judge, and more.`,
};

const featuredCategories = [
  { id: "all", name: "All Templates", count: evaluationTemplates.length },
  { id: "chatbot", name: "Chatbots", count: getTemplatesByCategory("chatbot").length },
  { id: "rag", name: "RAG Systems", count: getTemplatesByCategory("rag").length },
  { id: "code-gen", name: "Code Generation", count: getTemplatesByCategory("code-gen").length },
  { id: "content", name: "Content", count: getTemplatesByCategory("content").length },
  {
    id: "classification",
    name: "Classification",
    count: getTemplatesByCategory("classification").length,
  },
];

/** Strip the icon (React component function) to make templates serializable for client components */
function toSerializable(template: { icon?: any; [key: string]: any }): CatalogTemplateData {
  const { icon, ...rest } = template;
  return rest as CatalogTemplateData;
}

export default function TemplatesPage() {
  const totalTemplates = COMPREHENSIVE_TEMPLATES.length + evaluationTemplates.length;

  return (
    <div className="container mx-auto px-4 py-12 space-y-12">
      {/* Hero */}
      <div className="text-center space-y-4">
        <Badge variant="secondary" className="text-sm">
          {totalTemplates}+ Templates
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight">Evaluation Templates</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Copy/paste ready templates for common AI evaluation scenarios. From chatbots to
          adversarial testing, LLM judges to production monitoring.
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
          icon={<Layers className="h-5 w-5" />}
          label="Categories"
          value="17"
          description="Across all eval types"
        />
        <StatCard
          icon={<Search className="h-5 w-5" />}
          label="Free Forever"
          value="100%"
          description="All templates free"
        />
      </div>

      {/* Featured Quick Start Templates */}
      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Quick Start Templates</h2>
          <p className="text-muted-foreground mt-1">
            Copy-paste ready code examples to get started in minutes
          </p>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            {featuredCategories.map((cat) => (
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

          {featuredCategories.slice(1).map((cat) => (
            <TabsContent key={cat.id} value={cat.id} className="mt-8">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {getTemplatesByCategory(cat.id as any).map((template) => (
                  <TemplateCard key={template.id} template={template} />
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </section>

      {/* Full Template Catalog */}
      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">All Templates</h2>
          <p className="text-muted-foreground mt-1">
            Browse {COMPREHENSIVE_TEMPLATES.length}+ templates across every evaluation category
          </p>
        </div>

        <Tabs defaultValue="catalog-all" className="w-full">
          <TabsList className="flex flex-wrap gap-1 h-auto p-1">
            <TabsTrigger value="catalog-all" className="text-xs">
              All ({COMPREHENSIVE_TEMPLATES.length})
            </TabsTrigger>
            {TEMPLATE_CATEGORIES.map((cat) => {
              const count = getCatalogTemplatesByCategory(cat.id).length;
              return (
                <TabsTrigger key={cat.id} value={`catalog-${cat.id}`} className="text-xs">
                  {cat.name} ({count})
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="catalog-all" className="mt-8">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {COMPREHENSIVE_TEMPLATES.map((template) => (
                <CatalogTemplateCard key={template.id} template={toSerializable(template)} />
              ))}
            </div>
          </TabsContent>

          {TEMPLATE_CATEGORIES.map((cat) => (
            <TabsContent key={cat.id} value={`catalog-${cat.id}`} className="mt-8">
              <p className="text-sm text-muted-foreground mb-6">{cat.description}</p>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {getCatalogTemplatesByCategory(cat.id).map((template) => (
                  <CatalogTemplateCard key={template.id} template={toSerializable(template)} />
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </section>

      {/* CTA */}
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="py-12">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold">Need a custom template?</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Contribute your own evaluation templates or request new ones through GitHub.
            </p>
            <div className="flex gap-4 justify-center">
              <a
                href="https://github.com/pauly7610/ai-evaluation-platform/pulls"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                Open a PR
              </a>
              <a href="/documentation" className="px-6 py-3 border rounded-md hover:bg-accent">
                View Documentation
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  description,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  description: string;
}) {
  return (
    <Card>
      <CardContent className="py-6">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-primary/10 rounded-lg">{icon}</div>
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
