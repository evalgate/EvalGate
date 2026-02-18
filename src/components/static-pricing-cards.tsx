import { Check } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const pricingPlans = [
  {
    name: "Developer",
    price: "Free",
    description: "Perfect for individual developers and small projects",
    features: [
      "5,000 traces/month",
      "1 project",
      "10 annotations/month",
      "100 traces per project",
      "10 evaluations per project",
      "Community support",
      "Basic integrations (OpenAI, Anthropic)",
    ],
    cta: "Get Started Free",
    href: "/auth/sign-up",
    popular: false,
  },
  {
    name: "Team",
    price: "$49",
    period: "/seat/month",
    description: "For growing teams building production AI applications",
    features: [
      "25,000 traces/month",
      "5 projects",
      "50 annotations/month",
      "500 traces per project",
      "50 evaluations per project",
      "Email support",
      "Advanced integrations",
      "Team collaboration",
    ],
    cta: "Start Free Trial",
    href: "/auth/sign-up",
    popular: true,
  },
  {
    name: "Professional",
    price: "$99",
    period: "/seat/month",
    description: "For organizations with advanced evaluation needs",
    features: [
      "100,000 traces/month",
      "Unlimited projects",
      "Unlimited annotations",
      "Unlimited traces per project",
      "Unlimited evaluations",
      "Priority support",
      "Advanced features (LLM Judge, A/B testing)",
      "Custom integrations",
      "SLA guarantee",
    ],
    cta: "Start Free Trial",
    href: "/auth/sign-up",
    popular: false,
  },
];

export function StaticPricingCards() {
  return (
    <div className="grid md:grid-cols-3 gap-6 max-w-7xl mx-auto">
      {pricingPlans.map((plan) => (
        <Card
          key={plan.name}
          className={`p-6 flex flex-col ${
            plan.popular ? "border-primary shadow-lg scale-105 relative" : ""
          }`}
        >
          {plan.popular && (
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
              Most Popular
            </div>
          )}

          <div className="mb-6">
            <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
            <p className="text-muted-foreground text-sm mb-4">{plan.description}</p>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold">{plan.price}</span>
              {plan.period && <span className="text-muted-foreground">{plan.period}</span>}
            </div>
          </div>

          <ul className="space-y-3 mb-6 flex-grow">
            {plan.features.map((feature, index) => (
              <li key={index} className="flex items-start gap-2">
                <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-sm">{feature}</span>
              </li>
            ))}
          </ul>

          <Button
            asChild
            variant={plan.popular ? "default" : "outline"}
            className="w-full"
            size="lg"
          >
            <Link href={plan.href}>{plan.cta}</Link>
          </Button>
        </Card>
      ))}
    </div>
  );
}

export function PricingOverageInfo() {
  return (
    <Card className="p-6 mt-8 max-w-4xl mx-auto">
      <h3 className="text-xl font-semibold mb-4">Overage Pricing</h3>
      <div className="grid md:grid-cols-2 gap-4 text-sm">
        <div>
          <p className="font-medium mb-2">Additional Traces</p>
          <p className="text-muted-foreground">$0.01 per 100 traces above your plan limit</p>
        </div>
        <div>
          <p className="font-medium mb-2">Additional Annotations</p>
          <p className="text-muted-foreground">$0.50 per annotation above your plan limit</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-4">
        All plans include a 14-day free trial. No credit card required. Cancel anytime.
      </p>
    </Card>
  );
}

export function PricingRateLimits() {
  return (
    <Card className="p-6 mt-8 max-w-4xl mx-auto">
      <h3 className="text-xl font-semibold mb-4">API Rate Limits</h3>
      <div className="space-y-3 text-sm">
        <div className="flex justify-between items-center pb-2 border-b">
          <span className="font-medium">Developer</span>
          <span className="text-muted-foreground">100 requests/hour</span>
        </div>
        <div className="flex justify-between items-center pb-2 border-b">
          <span className="font-medium">Team</span>
          <span className="text-muted-foreground">500 requests/hour</span>
        </div>
        <div className="flex justify-between items-center pb-2 border-b">
          <span className="font-medium">Professional</span>
          <span className="text-muted-foreground">1,000 requests/hour</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-medium">Enterprise</span>
          <span className="text-muted-foreground">Custom limits</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-4">
        Rate limits align with your plan tier. Contact us for higher limits.
      </p>
      <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
        <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
          <strong>After limits:</strong> Requests return HTTP 429 unless overage billing is enabled
          in your plan.
        </p>
      </div>
    </Card>
  );
}
