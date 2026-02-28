import { Clock, Eye, FileText, Lock, Scale, Shield, Users } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Security & Data Handling — EvalAI",
	description:
		"Learn how EvalAI protects your data with encryption, access controls, PII redaction, and compliance governance templates.",
};

export const revalidate = 3600;

function Section({
	icon: Icon,
	title,
	children,
}: {
	icon: React.ComponentType<{ className?: string }>;
	title: string;
	children: React.ReactNode;
}) {
	return (
		<section className="rounded-lg border border-border bg-card p-6 sm:p-8">
			<div className="mb-4 flex items-center gap-3">
				<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
					<Icon className="h-5 w-5 text-primary" />
				</div>
				<h2 className="text-xl font-semibold">{title}</h2>
			</div>
			{children}
		</section>
	);
}

function Item({ children }: { children: React.ReactNode }) {
	return (
		<li className="flex items-start gap-2 text-muted-foreground">
			<span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary/60" />
			<span>{children}</span>
		</li>
	);
}

export default function SecurityPage() {
	return (
		<div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24">
			<div className="mb-12 text-center">
				<h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
					Security &amp; Data Handling
				</h1>
				<p className="mt-4 text-lg text-muted-foreground">
					How EvalAI protects your data throughout the evaluation lifecycle.
				</p>
			</div>

			<div className="grid gap-6">
				<Section icon={Lock} title="Encryption">
					<ul className="space-y-2">
						<Item>All data encrypted in transit via TLS</Item>
						<Item>
							Secrets encrypted at rest using provider-managed encryption
						</Item>
						<Item>API keys stored as SHA-256 hashes — never in plaintext</Item>
						<Item>
							Provider keys encrypted using AES-256 via application-managed
							encryption keys
						</Item>
					</ul>
				</Section>

				<Section icon={Clock} title="Data Retention">
					<ul className="space-y-2">
						<Item>Account data retained for 90 days after deletion</Item>
						<Item>Trace data: 90 days (free tier), 1 year (paid tiers)</Item>
						<Item>Evaluation results: duration of subscription + 90 days</Item>
						<Item>Share links: configurable expiry with a 7-day default</Item>
					</ul>
				</Section>

				<Section icon={Eye} title="PII Protection">
					<ul className="space-y-2">
						<Item>
							Automatic PII redaction in shared exports — emails, SSNs, phone
							numbers, credit cards, and API keys
						</Item>
						<Item>
							Redaction enabled by default; opt-out available for org admins
						</Item>
						<Item>
							Export size limits (10 MB) to prevent bulk data extraction
						</Item>
					</ul>
				</Section>

				<Section icon={FileText} title="Audit Trail">
					<ul className="space-y-2">
						<Item>Full audit trail for critical mutations</Item>
						<Item>Immutable audit log entries</Item>
						<Item>Admin-only read access to audit logs</Item>
					</ul>
				</Section>

				<Section icon={Users} title="Access Control">
					<ul className="space-y-2">
						<Item>
							Multi-tenant architecture with organization-scoped data isolation
						</Item>
						<Item>Role-based access control: viewer, member, admin, owner</Item>
						<Item>
							Scope-based API key authorization with wildcard rejection
						</Item>
					</ul>
				</Section>

				<Section icon={Scale} title="Compliance Framework Support">
					<ul className="space-y-2">
						<Item>
							Governance policy templates available: BASIC, SOC2, GDPR, HIPAA,
							FINRA_4511, PCI_DSS
						</Item>
					</ul>
					<div className="mt-4 space-y-2 rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
						<p>
							These are policy templates for evaluation governance, not
							certifications.
						</p>
						<p>
							Runs on infrastructure providers that support SOC 2 reports
							(available on request).
						</p>
					</div>
				</Section>

				<Section icon={Shield} title="Rate Limiting">
					<ul className="space-y-2">
						<Item>
							Tier-based rate limiting: 30–10,000 requests/min depending on plan
						</Item>
						<Item>Redis-backed sliding window algorithm</Item>
					</ul>
				</Section>
			</div>
		</div>
	);
}
