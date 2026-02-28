"use client";

import { ArrowRight, Code, Settings, Shield, Zap } from "lucide-react";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSession } from "@/lib/auth-client";

export default function MCPPage() {
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
								<Zap className="h-6 w-6 text-purple-500" />
							</div>
							<div>
								<h1 className="text-3xl sm:text-4xl font-bold mb-2">
									MCP Integration
								</h1>
								<p className="text-lg text-muted-foreground">
									MCP-compatible tool discovery and execution for AI agents
								</p>
							</div>
						</div>
						<div className="flex flex-wrap gap-4">
							<div className="flex items-center gap-2 text-sm text-green-600">
								<Code className="h-4 w-4" />
								Cursor compatible
							</div>
							<div className="flex items-center gap-2 text-sm text-green-600">
								<Shield className="h-4 w-4" />
								Claude compatible
							</div>
							<div className="flex items-center gap-2 text-sm text-green-600">
								<Zap className="h-4 w-4" />
								ChatGPT compatible
							</div>
						</div>
					</div>

					{/* Overview */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">Overview</h2>
						<p className="text-muted-foreground mb-4">
							EvalAI exposes an{" "}
							<strong>MCP-style tool discovery and execution API</strong> for AI
							agents. Tools map to platform services: evaluations, quality
							scores, traces, spans, and test cases.
						</p>

						<div className="grid gap-4 md:grid-cols-2">
							<div className="space-y-2">
								<h3 className="font-semibold">Available Tools</h3>
								<ul className="text-sm text-muted-foreground space-y-1">
									<li>• Quality score retrieval</li>
									<li>• Evaluation management</li>
									<li>• Trace and span operations</li>
									<li>• Test case management</li>
								</ul>
							</div>
							<div className="space-y-2">
								<h3 className="font-semibold">Supported Agents</h3>
								<ul className="text-sm text-muted-foreground space-y-1">
									<li>• Cursor IDE</li>
									<li>• Claude Desktop</li>
									<li>• ChatGPT Plugins</li>
									<li>• Custom MCP clients</li>
								</ul>
							</div>
						</div>
					</Card>

					{/* Endpoints */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">API Endpoints</h2>
						<div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
							<table className="w-full">
								<thead>
									<tr className="border-b">
										<th className="text-left pb-2">Method</th>
										<th className="text-left pb-2">Endpoint</th>
										<th className="text-left pb-2">Auth</th>
										<th className="text-left pb-2">Description</th>
									</tr>
								</thead>
								<tbody>
									<tr>
										<td className="py-2">GET</td>
										<td className="py-2">
											<code>/api/mcp/tools</code>
										</td>
										<td className="py-2">None</td>
										<td className="py-2">List available tools</td>
									</tr>
									<tr>
										<td className="py-2">POST</td>
										<td className="py-2">
											<code>/api/mcp/call</code>
										</td>
										<td className="py-2">Required</td>
										<td className="py-2">Execute a tool</td>
									</tr>
								</tbody>
							</table>
						</div>
					</Card>

					{/* Authentication */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">Authentication</h2>
						<p className="text-muted-foreground mb-4">
							Use either method for authenticated requests:
						</p>

						<div className="space-y-4">
							<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
								<h3 className="font-semibold text-blue-700 dark:text-blue-300 mb-2">
									Session Cookie
								</h3>
								<p className="text-sm text-blue-600 dark:text-blue-400">
									When using the platform in a browser, the session cookie is
									automatically included.
								</p>
							</div>

							<div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
								<h3 className="font-semibold text-green-700 dark:text-green-300 mb-2">
									API Key
								</h3>
								<div className="bg-muted rounded-lg p-3 font-mono text-sm mb-2">
									<code>Authorization: Bearer &lt;EVALAI_API_KEY&gt;</code>
								</div>
								<p className="text-sm text-green-600 dark:text-green-400">
									Get API keys from <strong>Settings → Developer</strong> in the
									app.
								</p>
							</div>
						</div>
					</Card>

					{/* Tool Discovery */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">Tool Discovery</h2>

						<div className="space-y-4">
							<div>
								<h3 className="font-semibold mb-2">Example Request</h3>
								<div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
									<pre>{`curl -X GET "https://eval.ai/api/mcp/tools"`}</pre>
								</div>
							</div>

							<div>
								<h3 className="font-semibold mb-2">Response Format</h3>
								<div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
									<pre>{`{
  "tools": [
    {
      "name": "eval.quality.latest",
      "description": "Get the latest quality score for an evaluation.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "evaluationId": { 
            "type": "number", 
            "description": "ID of the evaluation" 
          },
          "baseline": { 
            "type": "string", 
            "enum": ["published", "previous", "production"] 
          }
        },
        "required": ["evaluationId"]
      }
    }
  ]
}`}</pre>
								</div>
							</div>
						</div>
					</Card>

					{/* Tool Execution */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">Tool Execution</h2>

						<div className="space-y-4">
							<div>
								<h3 className="font-semibold mb-2">Example Request</h3>
								<div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
									<pre>{`curl -X POST "https://eval.ai/api/mcp/call" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "tool": "eval.quality.latest",
    "arguments": { 
      "evaluationId": 42, 
      "baseline": "published" 
    }
  }'`}</pre>
								</div>
							</div>

							<div className="grid gap-4 md:grid-cols-2">
								<div>
									<h3 className="font-semibold mb-2 text-green-600">
										Success (200)
									</h3>
									<div className="bg-muted rounded-lg p-3 font-mono text-xs overflow-x-auto">
										<pre>{`{
  "ok": true,
  "content": [
    { 
      "type": "text", 
      "text": "{\\"score\\":85,\\"baselineScore\\":82,...}" 
    }
  ]
}`}</pre>
									</div>
								</div>

								<div>
									<h3 className="font-semibold mb-2 text-red-600">
										Error (400)
									</h3>
									<div className="bg-muted rounded-lg p-3 font-mono text-xs overflow-x-auto">
										<pre>{`{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Evaluation not found",
    "requestId": "uuid"
  }
}`}</pre>
									</div>
								</div>
							</div>
						</div>
					</Card>

					{/* Available Tools */}
					<Card className="p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">Available Tools</h2>
						<div className="space-y-4">
							<div className="border-l-4 border-blue-500 pl-4">
								<h3 className="font-semibold">eval.quality.latest</h3>
								<p className="text-sm text-muted-foreground mb-2">
									Get the latest quality score for an evaluation
								</p>
								<div className="text-xs text-muted-foreground">
									<strong>Parameters:</strong> evaluationId (required), baseline
									(optional)
								</div>
							</div>

							<div className="border-l-4 border-green-500 pl-4">
								<h3 className="font-semibold">eval.run.create</h3>
								<p className="text-sm text-muted-foreground mb-2">
									Create a new evaluation run
								</p>
								<div className="text-xs text-muted-foreground">
									<strong>Parameters:</strong> evaluationId (required),
									environment (optional)
								</div>
							</div>

							<div className="border-l-4 border-purple-500 pl-4">
								<h3 className="font-semibold">eval.trace.create</h3>
								<p className="text-sm text-muted-foreground mb-2">
									Create a distributed trace
								</p>
								<div className="text-xs text-muted-foreground">
									<strong>Parameters:</strong> name (required), metadata
									(optional)
								</div>
							</div>

							<div className="border-l-4 border-orange-500 pl-4">
								<h3 className="font-semibold">eval.testcase.list</h3>
								<p className="text-sm text-muted-foreground mb-2">
									List test cases for an evaluation
								</p>
								<div className="text-xs text-muted-foreground">
									<strong>Parameters:</strong> evaluationId (required), limit
									(optional)
								</div>
							</div>
						</div>
					</Card>

					{/* Integration Examples */}
					<Card className="p-6">
						<h2 className="text-xl font-semibold mb-4">Integration Examples</h2>
						<div className="grid gap-4 md:grid-cols-2">
							<div className="space-y-3">
								<h3 className="font-semibold flex items-center gap-2">
									<Code className="h-4 w-4" />
									Cursor IDE
								</h3>
								<p className="text-sm text-muted-foreground">
									Add MCP server configuration to Cursor settings to enable
									AI-powered evaluation management directly in your IDE.
								</p>
								<div className="bg-muted rounded-lg p-3 font-mono text-xs">
									<pre>{`{
  "mcpServers": {
    "evalai": {
      "command": "curl",
      "args": ["https://eval.ai/api/mcp/tools"]
    }
  }
}`}</pre>
								</div>
							</div>

							<div className="space-y-3">
								<h3 className="font-semibold flex items-center gap-2">
									<Settings className="h-4 w-4" />
									Claude Desktop
								</h3>
								<p className="text-sm text-muted-foreground">
									Configure Claude Desktop to use EvalAI tools for evaluation
									management and quality scoring.
								</p>
								<div className="bg-muted rounded-lg p-3 font-mono text-xs">
									<pre>{`{
  "mcpServers": {
    "evalai": {
      "url": "https://eval.ai/api/mcp/tools",
      "auth": "Bearer YOUR_API_KEY"
    }
  }
}`}</pre>
								</div>
							</div>
						</div>
					</Card>

					{/* Next Steps */}
					<Card className="p-6 mt-8">
						<div className="text-center">
							<h2 className="text-xl font-semibold mb-4">Learn More</h2>
							<div className="flex justify-center gap-4">
								<Button variant="outline" asChild>
									<Link href="/docs/api-contract">
										API Contract <ArrowRight className="ml-2 h-4 w-4" />
									</Link>
								</Button>
								<Button variant="outline" asChild>
									<Link href="/api-reference">
										API Reference <ArrowRight className="ml-2 h-4 w-4" />
									</Link>
								</Button>
								<Button asChild>
									<Link href="/dashboard">
										Try It Now <ArrowRight className="ml-2 h-4 w-4" />
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
