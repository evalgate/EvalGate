"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { useSession } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useOrganizationId } from "@/hooks/use-organization"
import { getBearerToken } from "@/hooks/use-safe-storage"
import { Activity, Clock, AlertCircle, TrendingUp, BarChart3, Zap, Key, Webhook, Plus, Copy, Trash2, CheckCircle2 } from "lucide-react"
import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"

// Lazy load Recharts components
// Import as type "any" to avoid type conflicts with dynamic imports
const LineChart = dynamic<any>(
  () => import("recharts").then((mod) => mod.LineChart),
  { ssr: false }
)
const Line = dynamic<any>(() => import("recharts").then((mod) => mod.Line), { ssr: false })
const BarChart = dynamic<any>(
  () => import("recharts").then((mod) => mod.BarChart),
  { ssr: false }
)
const Bar = dynamic<any>(() => import("recharts").then((mod) => mod.Bar), { ssr: false })
const XAxis = dynamic<any>(() => import("recharts").then((mod) => mod.XAxis), { ssr: false })
const YAxis = dynamic<any>(() => import("recharts").then((mod) => mod.YAxis), { ssr: false })
const CartesianGrid = dynamic<any>(() => import("recharts").then((mod) => mod.CartesianGrid), { ssr: false })
const Tooltip = dynamic<any>(() => import("recharts").then((mod) => mod.Tooltip), { ssr: false })
const ResponsiveContainer = dynamic<any>(() => import("recharts").then((mod) => mod.ResponsiveContainer), { ssr: false })

interface UsageSummary {
  totalRequests: number
  avgResponseTime: number
  errorRate: number
  successRate: number
  requestsByStatusCode: Record<string, number>
  topEndpoints: Array<{ endpoint: string; count: number }>
  requestsOverTime: Array<{ date: string; count: number }>
}

interface APIKey {
  id: number
  name: string
  keyPrefix: string
  scopes: string[]
  lastUsedAt: string | null
  expiresAt: string | null
  revokedAt: string | null
  createdAt: string
}

const AVAILABLE_SCOPES = [
  { value: "traces:read", label: "Read Traces" },
  { value: "traces:write", label: "Write Traces" },
  { value: "evaluations:read", label: "Read Evaluations" },
  { value: "evaluations:write", label: "Write Evaluations" },
  { value: "llm-judge:read", label: "Read LLM Judge" },
  { value: "llm-judge:write", label: "Write LLM Judge" },
  { value: "annotations:read", label: "Read Annotations" },
  { value: "annotations:write", label: "Write Annotations" },
]

export default function DeveloperDashboardPage() {
  const { data: session, isPending } = useSession()
  const router = useRouter()
  const organizationId = useOrganizationId()
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<UsageSummary | null>(null)
  const [period, setPeriod] = useState("7d")
  
  // API Keys state
  const [apiKeys, setApiKeys] = useState<APIKey[]>([])
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newKeyDialogOpen, setNewKeyDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [keyToDelete, setKeyToDelete] = useState<number | null>(null)
  const [keyName, setKeyName] = useState("")
  const [selectedScopes, setSelectedScopes] = useState<string[]>([])
  const [expiresAt, setExpiresAt] = useState("")
  const [creating, setCreating] = useState(false)
  const [newApiKey, setNewApiKey] = useState<string>("")
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!isPending && !session?.user) {
      router.push("/auth/login")
    }
  }, [session, isPending, router])

  useEffect(() => {
    if (session?.user && organizationId) {
      fetchUsageSummary()
      fetchAPIKeys()
    }
  }, [session, period, organizationId])

  const fetchUsageSummary = async () => {
    if (!organizationId) return;
    
    try {
      const token = getBearerToken()
      if (!token) return;
      
      const response = await fetch(
        `/api/developer/usage/summary?organizationId=${organizationId}&period=${period}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (response.ok) {
        const data = await response.json()
        setSummary(data.summary)
      }
    } catch (error) {
      // Error already handled
    } finally {
      setLoading(false)
    }
  }

  const fetchAPIKeys = async () => {
    if (!organizationId) return
    
    try {
      const token = getBearerToken()
      if (!token) return

      const response = await fetch(
        `/api/developer/api-keys?organizationId=${organizationId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (response.ok) {
        const data = await response.json()
        setApiKeys(data)
      }
    } catch (error) {
      // Error handled
    }
  }

  const handleCreateKey = async () => {
    if (!keyName.trim()) {
      toast.error("Please enter a key name")
      return
    }

    if (selectedScopes.length === 0) {
      toast.error("Please select at least one scope")
      return
    }

    setCreating(true)

    try {
      const token = getBearerToken()
      if (!token) {
        toast.error("Authentication required")
        return
      }

      const response = await fetch("/api/developer/api-keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: keyName.trim(),
          organizationId,
          scopes: selectedScopes,
          expiresAt: expiresAt || null,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setNewApiKey(data.apiKey)
        setNewKeyDialogOpen(true)
        setCreateDialogOpen(false)
        
        // Reset form
        setKeyName("")
        setSelectedScopes([])
        setExpiresAt("")
        
        // Refresh list
        fetchAPIKeys()
        
        toast.success("API key created successfully")
      } else {
        const error = await response.json()
        toast.error(error.error || "Failed to create API key")
      }
    } catch (error) {
      toast.error("Error creating API key")
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteKey = async () => {
    if (!keyToDelete) return

    try {
      const token = getBearerToken()
      if (!token) return

      const response = await fetch(`/api/developer/api-keys/${keyToDelete}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        toast.success("API key revoked successfully")
        fetchAPIKeys()
      } else {
        toast.error("Failed to revoke API key")
      }
    } catch (error) {
      toast.error("Error revoking API key")
    } finally {
      setDeleteDialogOpen(false)
      setKeyToDelete(null)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success("Copied to clipboard")
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast.error("Failed to copy")
    }
  }

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope)
        ? prev.filter((s) => s !== scope)
        : [...prev, scope]
    )
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never"
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  if (isPending || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!session?.user) {
    return null
  }

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 md:p-8 pt-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Developer Dashboard</h2>
            <p className="text-muted-foreground">
              API usage metrics, analytics, and performance insights
            </p>
          </div>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-4 py-2 border rounded-lg bg-background"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>

      </div>

      {summary && (
        <>
          {/* Stats Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Requests</p>
                  <p className="text-2xl font-bold">{summary.totalRequests.toLocaleString()}</p>
                </div>
                <Activity className="h-8 w-8 text-blue-500" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Avg Response Time</p>
                  <p className="text-2xl font-bold">{summary.avgResponseTime}ms</p>
                </div>
                <Clock className="h-8 w-8 text-green-500" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Error Rate</p>
                  <p className="text-2xl font-bold">{summary.errorRate.toFixed(2)}%</p>
                </div>
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                  <p className="text-2xl font-bold">{summary.successRate.toFixed(2)}%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-emerald-500" />
              </div>
            </Card>
          </div>

          {/* Charts Grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Requests Over Time */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Requests Over Time
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={summary.requestsOverTime}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            {/* Top Endpoints */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Top Endpoints
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={summary.topEndpoints.slice(0, 5)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="endpoint" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Status Codes */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Requests by Status Code</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {Object.entries(summary.requestsByStatusCode).map(([code, count]) => (
                <div key={code} className="text-center p-4 border rounded-lg">
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-sm text-muted-foreground">{code}</p>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {/* Quick Start Guide */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg">🚀 Quick Start with the SDK</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="font-semibold mb-1">1. Create API Key</div>
              <p className="text-muted-foreground text-xs">Generate your key below</p>
            </div>
            <div>
              <div className="font-semibold mb-1">2. Install SDK</div>
              <code className="text-xs bg-background/50 px-2 py-1 rounded">npm install @evalai/sdk</code>
            </div>
            <div>
              <div className="font-semibold mb-1">3. Add to .env</div>
              <code className="text-xs bg-background/50 px-2 py-1 rounded block">EVALAI_API_KEY=...</code>
            </div>
            <div>
              <div className="font-semibold mb-1">4. Initialize</div>
              <code className="text-xs bg-background/50 px-2 py-1 rounded block">AIEvalClient.init()</code>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Keys Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                API Keys
              </CardTitle>
              <CardDescription>
                Create and manage API keys for SDK authentication
              </CardDescription>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create API Key
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {apiKeys.length === 0 ? (
            <div className="text-center py-12">
              <Key className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">No API keys yet</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Create your first API key to start using the SDK
              </p>
              <Button
                onClick={() => setCreateDialogOpen(true)}
                className="mt-4"
                variant="outline"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create API Key
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Scopes</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {key.keyPrefix}...
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {key.scopes.slice(0, 2).map((scope) => (
                          <Badge key={scope} variant="secondary" className="text-xs">
                            {scope.split(":")[0]}
                          </Badge>
                        ))}
                        {key.scopes.length > 2 && (
                          <Badge variant="secondary" className="text-xs">
                            +{key.scopes.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(key.lastUsedAt)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(key.createdAt)}
                    </TableCell>
                    <TableCell>
                      {key.revokedAt ? (
                        <Badge variant="destructive">Revoked</Badge>
                      ) : key.expiresAt && new Date(key.expiresAt) < new Date() ? (
                        <Badge variant="outline">Expired</Badge>
                      ) : (
                        <Badge variant="default" className="bg-green-500">
                          Active
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setKeyToDelete(key.id)
                          setDeleteDialogOpen(true)
                        }}
                        disabled={!!key.revokedAt}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create API Key Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Create a new API key for programmatic access. You'll only see the key once.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Key Name</Label>
              <Input
                id="name"
                placeholder="Production API Key"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                A descriptive name to identify this key
              </p>
            </div>

            <div className="space-y-2">
              <Label>Scopes</Label>
              <div className="grid grid-cols-2 gap-2">
                {AVAILABLE_SCOPES.map((scope) => (
                  <div key={scope.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={scope.value}
                      checked={selectedScopes.includes(scope.value)}
                      onCheckedChange={() => toggleScope(scope.value)}
                    />
                    <label
                      htmlFor={scope.value}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {scope.label}
                    </label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Select the permissions this key should have
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expires">Expiration Date (Optional)</Label>
              <Input
                id="expires"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty for no expiration
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateKey} disabled={creating}>
              {creating ? "Creating..." : "Create Key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New API Key Display Dialog */}
      <Dialog open={newKeyDialogOpen} onOpenChange={setNewKeyDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              API Key Created Successfully
            </DialogTitle>
            <DialogDescription>
              Follow these steps to start using the SDK in your project
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Step 1: Copy API Key */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">Step 1: Copy Your API Key</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Save this key securely - you won't be able to see it again!
              </p>
              <div className="flex gap-2">
                <Input
                  value={newApiKey}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => copyToClipboard(newApiKey)}
                >
                  {copied ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Step 2: Install SDK */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">Step 2: Install the SDK</Label>
              <div className="bg-muted p-3 rounded-md">
                <code className="text-sm">npm install @evalai/sdk</code>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-2"
                  onClick={() => copyToClipboard("npm install @evalai/sdk")}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Step 3: Configure Environment */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">Step 3: Add to Your .env File</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Create a <code className="bg-muted px-1 rounded">.env</code> file in your project root:
              </p>
              <div className="bg-muted p-3 rounded-md font-mono text-sm space-y-1">
                <div className="flex items-center justify-between">
                  <div>
                    <div>EVALAI_API_KEY={newApiKey}</div>
                    <div>EVALAI_ORGANIZATION_ID={organizationId}</div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(`EVALAI_API_KEY=${newApiKey}\nEVALAI_ORGANIZATION_ID=${organizationId}`)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Step 4: Initialize Client */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">Step 4: Initialize the Client</Label>
              <div className="bg-muted p-3 rounded-md">
                <pre className="text-sm overflow-x-auto">
{`import { AIEvalClient } from '@evalai/sdk'

// Auto-loads from environment variables
const client = AIEvalClient.init()

// Start using the SDK
const trace = await client.traces.create({
  name: 'My First Trace',
  traceId: 'trace-001'
})`}
                </pre>
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-2"
                  onClick={() => copyToClipboard(`import { AIEvalClient } from '@evalai/sdk'\n\nconst client = AIEvalClient.init()\n\nconst trace = await client.traces.create({\n  name: 'My First Trace',\n  traceId: 'trace-001'\n})`)}
                >
                  <Copy className="h-3 w-3 mr-2" />
                  Copy Code
                </Button>
              </div>
            </div>

            {/* Security Warning */}
            <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
              <div className="flex gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Security Best Practices</p>
                  <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Never commit .env files to version control</li>
                    <li>Add .env to your .gitignore file</li>
                    <li>Use different keys for development and production</li>
                    <li>Rotate keys regularly</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" asChild className="flex-1">
                <a href="/documentation" target="_blank">
                  View Full Documentation
                </a>
              </Button>
              <Button variant="outline" asChild className="flex-1">
                <a href="/api-reference" target="_blank">
                  API Reference
                </a>
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setNewKeyDialogOpen(false)} className="w-full">
              Got It, Start Building!
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately revoke the API key. Any applications using this key will no
              longer be able to access the API. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteKey}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}