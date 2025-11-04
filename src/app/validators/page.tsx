import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  CheckCircle2, 
  Shield, 
  Code, 
  FileJson, 
  Clock, 
  DollarSign, 
  Target,
  AlertTriangle,
  Sparkles,
  Regex,
  Database,
  Zap
} from "lucide-react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Validators - AI Evaluation Platform",
  description: "Built-in validators for evaluating LLM outputs: factuality, toxicity, latency, cost, and more.",
  openGraph: {
    title: "Validators - AI Evaluation Platform",
    description: "Built-in validators for evaluating LLM outputs: factuality, toxicity, latency, cost, and more.",
    type: "website",
  },
}

interface Validator {
  name: string
  description: string
  icon: any
  category: "Quality" | "Safety" | "Performance" | "Structure"
  color: string
}

const validators: Validator[] = [
  {
    name: "Factuality",
    description: "Checks factual correctness using LLM-judge consensus and knowledge base verification.",
    icon: CheckCircle2,
    category: "Quality",
    color: "text-blue-500"
  },
  {
    name: "Toxicity",
    description: "Detects unsafe, biased, or harmful responses using multi-model detection.",
    icon: Shield,
    category: "Safety",
    color: "text-red-500"
  },
  {
    name: "RegexMatch",
    description: "Ensures model output conforms to a specific pattern or format.",
    icon: Regex,
    category: "Structure",
    color: "text-purple-500"
  },
  {
    name: "JSONSchema",
    description: "Validates JSON outputs against a defined schema with type checking.",
    icon: FileJson,
    category: "Structure",
    color: "text-emerald-500"
  },
  {
    name: "Latency",
    description: "Measures response time per span and flags slow operations.",
    icon: Clock,
    category: "Performance",
    color: "text-orange-500"
  },
  {
    name: "Cost",
    description: "Tracks token usage and calculates estimated USD cost per operation.",
    icon: DollarSign,
    category: "Performance",
    color: "text-green-500"
  },
  {
    name: "Determinism",
    description: "Compares multiple runs for consistency and stability of outputs.",
    icon: Target,
    category: "Quality",
    color: "text-indigo-500"
  },
  {
    name: "Hallucination",
    description: "Detects when AI generates information not present in source context.",
    icon: AlertTriangle,
    category: "Quality",
    color: "text-yellow-500"
  },
  {
    name: "Relevance",
    description: "Measures how well the output addresses the input query or prompt.",
    icon: Sparkles,
    category: "Quality",
    color: "text-pink-500"
  },
  {
    name: "CodeValidity",
    description: "Validates generated code for syntax errors and basic correctness.",
    icon: Code,
    category: "Structure",
    color: "text-cyan-500"
  },
  {
    name: "Groundedness",
    description: "Verifies that responses are grounded in provided context or documentation.",
    icon: Database,
    category: "Quality",
    color: "text-violet-500"
  },
  {
    name: "Coherence",
    description: "Evaluates logical flow and consistency within the generated response.",
    icon: Zap,
    category: "Quality",
    color: "text-amber-500"
  }
]

const categoryColors = {
  Quality: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  Safety: "bg-red-500/10 text-red-500 border-red-500/20",
  Performance: "bg-green-500/10 text-green-500 border-green-500/20",
  Structure: "bg-purple-500/10 text-purple-500 border-purple-500/20"
}

export default function ValidatorsPage() {
  const categories = Array.from(new Set(validators.map(v => v.category)))

  return (
    <div className="container mx-auto px-4 py-12 max-w-7xl">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 bg-blue-500/10 rounded-full">
          <CheckCircle2 className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium text-blue-500">20+ Built-in Validators</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
          Comprehensive <span className="text-blue-500">Validation</span> Suite
        </h1>
        <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
          Pre-built validators for every aspect of LLM evaluation. From factuality to performance,
          ensure your AI outputs meet quality standards.
        </p>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-6 mb-12">
        <Card className="p-6 text-center">
          <div className="text-3xl font-bold text-blue-500 mb-2">20+</div>
          <div className="text-sm text-muted-foreground">Validators</div>
        </Card>
        <Card className="p-6 text-center">
          <div className="text-3xl font-bold text-emerald-500 mb-2">4</div>
          <div className="text-sm text-muted-foreground">Categories</div>
        </Card>
        <Card className="p-6 text-center">
          <div className="text-3xl font-bold text-purple-500 mb-2">100%</div>
          <div className="text-sm text-muted-foreground">Customizable</div>
        </Card>
        <Card className="p-6 text-center">
          <div className="text-3xl font-bold text-orange-500 mb-2">&lt;100ms</div>
          <div className="text-sm text-muted-foreground">Avg Latency</div>
        </Card>
      </div>

      {/* Validators by Category */}
      {categories.map(category => (
        <div key={category} className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-2xl font-bold">{category}</h2>
            <Badge variant="outline" className={categoryColors[category as keyof typeof categoryColors]}>
              {validators.filter(v => v.category === category).length} validators
            </Badge>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {validators
              .filter(v => v.category === category)
              .map(validator => {
                const Icon = validator.icon
                return (
                  <Card 
                    key={validator.name} 
                    className="p-6 hover:shadow-lg transition-shadow cursor-pointer group"
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-lg bg-muted/50 group-hover:scale-110 transition-transform`}>
                        <Icon className={`h-6 w-6 ${validator.color}`} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold mb-2 group-hover:text-blue-500 transition-colors">
                          {validator.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {validator.description}
                        </p>
                      </div>
                    </div>
                  </Card>
                )
              })}
          </div>
        </div>
      ))}

      {/* Custom Validators CTA */}
      <Card className="p-8 bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/20">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Need a Custom Validator?</h2>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Create your own validators using our SDK. Define custom logic, thresholds, and scoring functions
            tailored to your specific use case.
          </p>
          <div className="flex gap-4 justify-center">
            <a 
              href="/sdk" 
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
            >
              View SDK Docs
            </a>
            <a 
              href="/api-reference" 
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
            >
              API Reference
            </a>
          </div>
        </div>
      </Card>
    </div>
  )
}
