"use client";

import {
	ArrowRight,
	Clock,
	DollarSign,
	Settings,
	Shield,
	Users,
} from "lucide-react";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSession } from "@/lib/auth-client";

export default function AgentGovernancePage() {
	const { data: session } = useSession();

	return (
		<div className="min-h-screen bg-background text-foreground flex flex-col">
			{/* Header */}
			<header className="border-b border-border">
				<div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 sm:py-4">
					<div className="flex items-center justify-between gap-3">
						<Link href="/">
							<h1 className="text-base sm:text-xl font-bold truncate">
								AI Evaluation Platform
							</h1>
						</Link>
						<div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
							<ThemeToggle />
							{session?.user ? (
								<Button asChild size="sm" className="h-9">
									<Link href="/dashboard">Dashboard</Link>
								</Button>
							) : (
								<>
									<Button
										variant="ghost"
										asChild
										size="sm"
										className="h-9 hidden sm:flex"
									>
										<Link href="/auth/login">Sign in</Link>
									</Button>
									<Button asChild size="sm" className="h-9">
										<Link href="/auth/sign-up">Get started</Link>
									</Button>
								</>
							)}
						</div>
					</div>
				</div>
			</header>

			{/* Main Content */}
			<main className="flex-1">
				<div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-12">
					{/* Breadcrumb */}
					<nav className="mb-8">
						<Link
							href="/documentation"
							className="text-sm text-muted-foreground hover:text-foreground transition-colors"
						>
							← Back to Documentation
						</Link>
					</nav>

					{/* Hero */}
					<div className="mb-12">
						<div className="flex items-center gap-3 mb-4">
							<div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-500/10">
								<Shield className="h-6 w-6 text-purple-500" />
							</div>
							<div>
								<h1 className="text-3xl sm:text-4xl font-bold mb-2">
									Agent Governance Framework
								</h1>
								<p className="text-lg text-muted-foreground">
									Enterprise-grade governance for multi-agent AI systems
								</p>
							</div>
						</div>
						<div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
							<p className="text-sm text-purple-600 dark:text-purple-400">
								EvalAI's orchestration layer provides enterprise-grade
								governance for multi-agent AI systems. This framework enables
								organizations to deploy, monitor, audit, and optimize AI agents
								with full compliance and cost visibility.
							</p>
						</div>
					</div>

					{/* Compliance Features */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">Compliance Features</h2>

						<div className="space-y-6">
							<div>
								<h3 className="font-semibold mb-3">Audit Trails</h3>
								<p className="text-muted-foreground mb-4">
									Every agent decision includes comprehensive audit data:
								</p>
								<div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
									<table className="w-full">
										<thead>
											<tr className="border-b">
												<th className="text-left py-2">Field</th>
												<th className="text-left py-2">Description</th>
											</tr>
										</thead>
										<tbody>
											<tr>
												<td className="py-2">
													<strong>Reasoning Chain</strong>
												</td>
												<td className="py-2">
													Full explanation of why this decision was made over
													alternatives
												</td>
											</tr>
											<tr>
												<td className="py-2">
													<strong>Confidence Scores</strong>
												</td>
												<td className="py-2">
													0-100 scale indicating decision certainty
												</td>
											</tr>
											<tr>
												<td className="py-2">
													<strong>Cost Attribution</strong>
												</td>
												<td className="py-2">
													Per-agent, per-model cost breakdown
												</td>
											</tr>
											<tr>
												<td className="py-2">
													<strong>Execution Timestamps</strong>
												</td>
												<td className="py-2">
													Precise timing for regulatory reporting
												</td>
											</tr>
											<tr>
												<td className="py-2">
													<strong>Alternative Analysis</strong>
												</td>
												<td className="py-2">
													What other options were considered and why they were
													rejected
												</td>
											</tr>
										</tbody>
									</table>
								</div>
							</div>

							<div>
								<h3 className="font-semibold mb-3">Example Decision Record</h3>
								<div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
									<pre>{`{
  agent: "RouterAgent",
  decisionType: "route",
  chosen: "technical_support",
  confidence: 85,
  alternatives: [
    { action: "billing_support", confidence: 0.3, reasoning: "No billing keywords" },
    { action: "general_support", confidence: 0.1, reasoning: "Fallback option" }
  ],
  reasoning: "Query contains technical terms: 'API', 'error', 'endpoint'",
  timestamp: "2024-01-15T10:30:00Z"
}`}</pre>
								</div>
							</div>

							<div>
								<h3 className="font-semibold mb-3">
									Supported Compliance Standards
								</h3>
								<div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
									<table className="w-full">
										<thead>
											<tr className="border-b">
												<th className="text-left py-2">Standard</th>
												<th className="text-left py-2">Description</th>
												<th className="text-left py-2">Configuration</th>
											</tr>
										</thead>
										<tbody>
											<tr>
												<td className="py-2">
													<strong>SOC2</strong>
												</td>
												<td className="py-2">Service Organization Control</td>
												<td className="py-2">
													<code>auditLevel: 'SOC2'</code>
												</td>
											</tr>
											<tr>
												<td className="py-2">
													<strong>GDPR</strong>
												</td>
												<td className="py-2">EU Data Protection</td>
												<td className="py-2">
													<code>auditLevel: 'GDPR'</code>
												</td>
											</tr>
											<tr>
												<td className="py-2">
													<strong>HIPAA</strong>
												</td>
												<td className="py-2">Healthcare Data</td>
												<td className="py-2">
													<code>auditLevel: 'HIPAA'</code>
												</td>
											</tr>
											<tr>
												<td className="py-2">
													<strong>FINRA 4511</strong>
												</td>
												<td className="py-2">Financial Services</td>
												<td className="py-2">
													<code>auditLevel: 'FINRA_4511'</code>
												</td>
											</tr>
											<tr>
												<td className="py-2">
													<strong>PCI DSS</strong>
												</td>
												<td className="py-2">Payment Card Industry</td>
												<td className="py-2">
													<code>auditLevel: 'PCI_DSS'</code>
												</td>
											</tr>
										</tbody>
									</table>
								</div>
							</div>
						</div>
					</Card>

					{/* Governance Rules */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">Governance Rules</h2>

						<div className="space-y-6">
							<div>
								<h3 className="font-semibold mb-3">Configuration</h3>
								<div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
									<pre>{`// Use a compliance preset
const governance = new GovernanceEngine(CompliancePresets.SOC2);

// Or configure custom rules
const governance = new GovernanceEngine({
  confidenceThreshold: 0.7,        // Require approval below 70% confidence
  amountThreshold: 500,            // Require approval for transactions > $500
  requireApprovalForSensitiveData: true,
  requireApprovalForPII: true,
  allowedModels: ['gpt-4', 'claude-sonnet-4'],
  maxCostPerRun: 5.00,
  auditLevel: 'FINRA_4511'
});`}</pre>
								</div>
							</div>

							<div>
								<h3 className="font-semibold mb-3">Approval Rules</h3>
								<p className="text-muted-foreground mb-4">
									Decisions automatically require human approval when:
								</p>
								<div className="space-y-3">
									<div className="flex items-start gap-3">
										<div className="h-2 w-2 rounded-full bg-red-500 mt-2"></div>
										<div>
											<strong>Low Confidence:</strong> Decision confidence below
											threshold (default: 70%)
										</div>
									</div>
									<div className="flex items-start gap-3">
										<div className="h-2 w-2 rounded-full bg-orange-500 mt-2"></div>
										<div>
											<strong>High Value:</strong> Transaction amount exceeds
											threshold (default: $500)
										</div>
									</div>
									<div className="flex items-start gap-3">
										<div className="h-2 w-2 rounded-full bg-yellow-500 mt-2"></div>
										<div>
											<strong>Sensitive Data:</strong> Context contains
											sensitive information
										</div>
									</div>
									<div className="flex items-start gap-3">
										<div className="h-2 w-2 rounded-full bg-purple-500 mt-2"></div>
										<div>
											<strong>PII Detected:</strong> Personally identifiable
											information in context
										</div>
									</div>
									<div className="flex items-start gap-3">
										<div className="h-2 w-2 rounded-full bg-blue-500 mt-2"></div>
										<div>
											<strong>Restricted Classification:</strong> Data marked as
											"restricted"
										</div>
									</div>
								</div>
							</div>
						</div>
					</Card>

					{/* Key Features */}
					<div className="grid gap-6 mb-8">
						<Card className="p-6">
							<div className="flex items-center gap-3 mb-4">
								<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
									<Users className="h-5 w-5 text-blue-500" />
								</div>
								<h3 className="text-lg font-semibold">Access Control</h3>
							</div>
							<ul className="text-sm text-muted-foreground space-y-1">
								<li>• Role-based permissions for agent management</li>
								<li>• Fine-grained API key scopes</li>
								<li>• Organization-level governance policies</li>
								<li>• Audit logging for all access events</li>
							</ul>
						</Card>

						<Card className="p-6">
							<div className="flex items-center gap-3 mb-4">
								<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
									<DollarSign className="h-5 w-5 text-green-500" />
								</div>
								<h3 className="text-lg font-semibold">Cost Controls</h3>
							</div>
							<ul className="text-sm text-muted-foreground space-y-1">
								<li>• Per-agent cost tracking and limits</li>
								<li>• Model-specific pricing controls</li>
								<li>• Budget alerts and enforcement</li>
								<li>• Cost attribution by project/team</li>
							</ul>
						</Card>

						<Card className="p-6">
							<div className="flex items-center gap-3 mb-4">
								<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
									<Clock className="h-5 w-5 text-purple-500" />
								</div>
								<h3 className="text-lg font-semibold">SLA Management</h3>
							</div>
							<ul className="text-sm text-muted-foreground space-y-1">
								<li>• Response time monitoring</li>
								<li>• Availability tracking</li>
								<li>• Performance degradation alerts</li>
								<li>• Automated failover protocols</li>
							</ul>
						</Card>

						<Card className="p-6">
							<div className="flex items-center gap-3 mb-4">
								<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
									<Settings className="h-5 w-5 text-orange-500" />
								</div>
								<h3 className="text-lg font-semibold">Architecture Patterns</h3>
							</div>
							<ul className="text-sm text-muted-foreground space-y-1">
								<li>• Microservices orchestration</li>
								<li>• Event-driven communication</li>
								<li>• Circuit breaker patterns</li>
								<li>• Distributed tracing</li>
							</ul>
						</Card>
					</div>

					{/* Integration Examples */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">Integration Examples</h2>

						<div className="space-y-4">
							<div>
								<h3 className="font-semibold mb-2">Financial Services Agent</h3>
								<div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
									<pre>{`const financialGovernance = new GovernanceEngine({
  auditLevel: 'FINRA_4511',
  confidenceThreshold: 0.8,
  amountThreshold: 1000,
  requireApprovalForPII: true,
  maxCostPerRun: 2.00,
  retentionDays: 2555  // 7 years for FINRA
});`}</pre>
								</div>
							</div>

							<div>
								<h3 className="font-semibold mb-2">Healthcare Agent</h3>
								<div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
									<pre>{`const healthcareGovernance = new GovernanceEngine({
  auditLevel: 'HIPAA',
  confidenceThreshold: 0.9,
  requireApprovalForSensitiveData: true,
  allowedModels: ['gpt-4'],  // HIPAA-compliant models only
  encryptionRequired: true,
  retentionDays: 3650  // 10 years for medical records
});`}</pre>
								</div>
							</div>
						</div>
					</Card>

					{/* API Reference */}
					<Card className="p-6">
						<h2 className="text-xl font-semibold mb-4">API Reference</h2>

						<div className="space-y-4">
							<div>
								<h3 className="font-semibold mb-2">GovernanceEngine</h3>
								<div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
									<pre>{`// Create governance engine
new GovernanceEngine(config: GovernanceConfig)

// Check if approval needed
needsApproval(decision: AgentDecision): boolean

// Record decision with audit trail
recordDecision(decision: AgentDecision): Promise<AuditRecord>

// Get compliance report
getComplianceReport(timeframe: TimeRange): Promise<ComplianceReport>`}</pre>
								</div>
							</div>

							<div>
								<h3 className="font-semibold mb-2">CompliancePresets</h3>
								<div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
									<pre>{`CompliancePresets.SOC2
CompliancePresets.GDPR
CompliancePresets.HIPAA
CompliancePresets.FINRA_4511
CompliancePresets.PCI_DSS`}</pre>
								</div>
							</div>
						</div>
					</Card>

					{/* Next Steps */}
					<Card className="p-6 mt-8">
						<div className="text-center">
							<h2 className="text-xl font-semibold mb-4">
								Implement Governance
							</h2>
							<div className="flex justify-center gap-4">
								<Button variant="outline" asChild>
									<Link href="/docs/integration-reference">
										Integration Reference{" "}
										<ArrowRight className="ml-2 h-4 w-4" />
									</Link>
								</Button>
								<Button variant="outline" asChild>
									<Link href="/docs/api-contract">
										API Contract <ArrowRight className="ml-2 h-4 w-4" />
									</Link>
								</Button>
								<Button asChild>
									<Link href="/dashboard">
										Configure Governance <ArrowRight className="ml-2 h-4 w-4" />
									</Link>
								</Button>
							</div>
						</div>
					</Card>
				</div>
			</main>

			{/* Footer */}
			<Footer />
		</div>
	);
}
