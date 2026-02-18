import { Beaker, Sparkles, Users, Zap } from "lucide-react";
import { memo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const FEATURES = [
  {
    icon: Beaker,
    title: "Unit Testing",
    description:
      "Automated assertions and test suites for LLM outputs with 20+ built-in validators",
  },
  {
    icon: Users,
    title: "Human Evaluation",
    description: "Collect expert feedback and annotations with customizable workflows",
  },
  {
    icon: Sparkles,
    title: "LLM Judge",
    description: "Model-as-a-judge evaluations with custom criteria and multi-judge consensus",
  },
  {
    icon: Zap,
    title: "Observability",
    description: "Real-time tracing and debugging for all your LLM calls",
  },
];

export const HomeFeatures = memo(function HomeFeatures() {
  return (
    <section className="py-16 sm:py-20 bg-muted/50">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
          Everything You Need to Evaluate AI
        </h2>
        <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
          From development to production, get comprehensive insights into your AI systems
        </p>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 max-w-7xl mx-auto">
          {FEATURES.map((feature) => (
            <Card key={feature.title}>
              <CardHeader>
                <feature.icon className="h-10 w-10 text-primary mb-2" />
                <CardTitle>{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
});
