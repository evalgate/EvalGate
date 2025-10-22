"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { useSession } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useOrganizationId } from "@/hooks/use-organization"
import { getBearerToken } from "@/hooks/use-safe-storage"
import { Badge } from "@/components/ui/badge"
import { Copy, Plus, Trash2, Eye, EyeOff, CheckCircle2, Webhook } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface ApiKey {
  id: number
  name: string
  keyPrefix: string
  scopes: string[]
  lastUsedAt: string | null
  expiresAt: string | null
  revokedAt: string | null
  createdAt: string
}

interface Webhook {
  id: number
  url: string
  events: string[]
  status: string
  lastDeliveredAt: string | null
  createdAt: string
}

const AVAILABLE_SCOPES = [
  { id: 'traces:read', label: 'Traces Read' },
  { id: 'traces:write', label: 'Traces Write' },
  { id: 'evaluations:read', label: 'Evaluations Read' },
  { id: 'evaluations:write', label: 'Evaluations Write' },
  { id: 'annotations:read', label: 'Annotations Read' },
  { id: 'annotations:write', label: 'Annotations Write' },
]

const AVAILABLE_EVENTS = [
  { id: 'trace.created', label: 'Trace Created' },
  { id: 'trace.completed', label: 'Trace Completed' },
  { id: 'trace.failed', label: 'Trace Failed' },
  { id: 'evaluation.started', label: 'Evaluation Started' },
  { id: 'evaluation.completed', label: 'Evaluation Completed' },
  { id: 'evaluation.failed', label: 'Evaluation Failed' },
  { id: 'span.created', label: 'Span Created' },
]

export default function SettingsPage() {
  const { data: session, isPending } = useSession()
  const router = useRouter()
  const organizationId = useOrganizationId()
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [loading, setLoading] = useState(true)
  const [webhooksLoading, setWebhooksLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createWebhookDialogOpen, setCreateWebhookDialogOpen] = useState(false)
  const [newKeyName, setNewKeyName] = useState("")
  const [selectedScopes, setSelectedScopes] = useState<string[]>([])
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [showCreatedKey, setShowCreatedKey] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState("")
  const [selectedEvents, setSelectedEvents] = useState<string[]>([])
  const [createdWebhookSecret, setCreatedWebhookSecret] = useState<string | null>(null)

  useEffect(() => {
    if (!isPending && !session?.user) {
      router.push("/auth/login")
    }
  }, [session, isPending, router])

  useEffect(() => {
    if (session?.user) {
      fetchApiKeys()
      fetchWebhooks()
    }
  }, [session])

  const fetchApiKeys = async () => {
    if (!organizationId) return;
    
    try {
      const token = getBearerToken();
      if (!token) {
        toast.error("Authentication required");
        return;
      }
      
      const response = await fetch(`/api/developer/api-keys?organizationId=${organizationId}&limit=50`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setApiKeys(data)
      } else {
        toast.error("Failed to fetch API keys");
      }
    } catch (error) {
      toast.error("Failed to fetch API keys");
    } finally {
      setLoading(false)
    }
  }

  const fetchWebhooks = async () => {
    if (!organizationId) return;
    
    try {
      const token = getBearerToken();
      if (!token) {
        toast.error("Authentication required");
        return;
      }
      
      const response = await fetch(`/api/developer/webhooks?organizationId=${organizationId}&limit=50`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setWebhooks(data)
      } else {
        toast.error("Failed to fetch webhooks");
      }
    } catch (error) {
      toast.error("Failed to fetch webhooks");
    } finally {
      setWebhooksLoading(false)
    }
  }

  const handleCreateKey = async () => {
    if (!newKeyName.trim() || selectedScopes.length === 0) {
      toast.error("Please provide a name and select at least one scope")
      return
    }
    
    if (!organizationId) {
      toast.error("Organization not found");
      return;
    }

    try {
      const token = getBearerToken();
      if (!token) {
        toast.error("Authentication required");
        return;
      }
      
      const response = await fetch("/api/developer/api-keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newKeyName,
          organizationId,
          scopes: selectedScopes,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setCreatedKey(data.apiKey)
        setShowCreatedKey(true)
        toast.success("API key created successfully")
        fetchApiKeys()
        setNewKeyName("")
        setSelectedScopes([])
      } else {
        const error = await response.json()
        toast.error(error.error || "Failed to create API key")
      }
    } catch (error) {
      toast.error("Failed to create API key")
    }
  }

  const handleCreateWebhook = async () => {
    if (!webhookUrl.trim() || selectedEvents.length === 0) {
      toast.error("Please provide a URL and select at least one event")
      return
    }

    try {
      const token = localStorage.getItem("bearer_token")
      const response = await fetch("/api/developer/webhooks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          organizationId,
          url: webhookUrl,
          events: selectedEvents,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setCreatedWebhookSecret(data.secret)
        toast.success("Webhook created successfully")
        fetchWebhooks()
        setWebhookUrl("")
        setSelectedEvents([])
      } else {
        const error = await response.json()
        toast.error(error.error || "Failed to create webhook")
      }
    } catch (error) {
      toast.error("Failed to create webhook")
    }
  }

  const handleRevokeKey = async (id: number) => {
    if (!confirm("Are you sure you want to revoke this API key? This action cannot be undone.")) {
      return
    }

    try {
      const token = localStorage.getItem("bearer_token")
      const response = await fetch(`/api/developer/api-keys/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        toast.success("API key revoked successfully")
        fetchApiKeys()
      } else {
        toast.error("Failed to revoke API key")
      }
    } catch (error) {
      toast.error("Failed to revoke API key")
    }
  }

  const handleDeleteWebhook = async (id: number) => {
    if (!confirm("Are you sure you want to delete this webhook?")) {
      return
    }

    try {
      const token = localStorage.getItem("bearer_token")
      const response = await fetch(`/api/developer/webhooks/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        toast.success("Webhook deleted successfully")
        fetchWebhooks()
      } else {
        toast.error("Failed to delete webhook")
      }
    } catch (error) {
      toast.error("Failed to delete webhook")
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("Copied to clipboard")
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never"
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 sm:h-8 sm:w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!session?.user) {
    return null
  }

  return (
    <div className="flex-1 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Settings</h2>
          <p className="text-sm sm:text-base text-muted-foreground">Manage your account settings and preferences.</p>
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card className="p-4 sm:p-6">
            <div className="space-y-4 sm:space-y-6">
              <div>
                <h3 className="text-base sm:text-lg font-semibold">Profile</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">Update your personal information</p>
              </div>
              <div className="grid gap-3 sm:gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="name" className="text-sm">Name</Label>
                  <Input id="name" placeholder="Your name" defaultValue={session.user.name} className="h-9 sm:h-10" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email" className="text-sm">Email</Label>
                  <Input id="email" type="email" placeholder="Your email" defaultValue={session.user.email} disabled className="h-9 sm:h-10" />
                </div>
              </div>
              <Button className="w-full sm:w-auto">Save changes</Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="api-keys" className="space-y-6">
          <Card className="p-4 sm:p-6">
            <div className="space-y-4 sm:space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base sm:text-lg font-semibold">API Keys</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">Manage your API keys for programmatic access</p>
                </div>
                <Button onClick={() => setCreateDialogOpen(true)} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Key
                </Button>
              </div>

              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : apiKeys.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No API keys yet. Create one to get started.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {apiKeys.map((key) => (
                    <div
                      key={key.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border rounded-lg"
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{key.name}</p>
                          {key.revokedAt && (
                            <Badge variant="destructive">Revoked</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground font-mono">{key.keyPrefix}...</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {key.scopes.map((scope) => (
                            <Badge key={scope} variant="secondary" className="text-xs">
                              {scope}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Last used: {formatDate(key.lastUsedAt)} • Created: {formatDate(key.createdAt)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {!key.revokedAt && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRevokeKey(key.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="webhooks" className="space-y-6">
          <Card className="p-4 sm:p-6">
            <div className="space-y-4 sm:space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base sm:text-lg font-semibold">Webhooks</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">Configure webhooks for real-time event notifications</p>
                </div>
                <Button onClick={() => setCreateWebhookDialogOpen(true)} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Webhook
                </Button>
              </div>

              {webhooksLoading ? (
                <div className="flex justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : webhooks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Webhook className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No webhooks configured yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {webhooks.map((webhook) => (
                    <div
                      key={webhook.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border rounded-lg"
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium font-mono text-sm">{webhook.url}</p>
                          <Badge variant={webhook.status === 'active' ? 'default' : 'secondary'}>
                            {webhook.status}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {webhook.events.map((event) => (
                            <Badge key={event} variant="outline" className="text-xs">
                              {event}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Last delivered: {formatDate(webhook.lastDeliveredAt)} • Created: {formatDate(webhook.createdAt)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteWebhook(webhook.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create API Key Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Generate a new API key for programmatic access to your account.
            </DialogDescription>
          </DialogHeader>

          {createdKey ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-green-500/10 text-green-600 rounded-lg">
                <CheckCircle2 className="h-5 w-5" />
                <p className="text-sm font-medium">API key created successfully!</p>
              </div>
              <div className="space-y-2">
                <Label>Your API Key</Label>
                <div className="flex gap-2">
                  <Input
                    value={createdKey}
                    readOnly
                    type={showCreatedKey ? "text" : "password"}
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowCreatedKey(!showCreatedKey)}
                  >
                    {showCreatedKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(createdKey)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-amber-600">
                  ⚠️ Make sure to copy this key now. You won't be able to see it again!
                </p>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => {
                    setCreatedKey(null)
                    setShowCreatedKey(false)
                    setCreateDialogOpen(false)
                  }}
                >
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="keyName">Key Name</Label>
                <Input
                  id="keyName"
                  placeholder="Production API Key"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Scopes</Label>
                <div className="space-y-2">
                  {AVAILABLE_SCOPES.map((scope) => (
                    <div key={scope.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={scope.id}
                        checked={selectedScopes.includes(scope.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedScopes([...selectedScopes, scope.id])
                          } else {
                            setSelectedScopes(selectedScopes.filter((s) => s !== scope.id))
                          }
                        }}
                      />
                      <label
                        htmlFor={scope.id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {scope.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateKey}>Create Key</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Webhook Dialog */}
      <Dialog open={createWebhookDialogOpen} onOpenChange={setCreateWebhookDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Webhook</DialogTitle>
            <DialogDescription>
              Configure a webhook to receive real-time event notifications.
            </DialogDescription>
          </DialogHeader>

          {createdWebhookSecret ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-green-500/10 text-green-600 rounded-lg">
                <CheckCircle2 className="h-5 w-5" />
                <p className="text-sm font-medium">Webhook created successfully!</p>
              </div>
              <div className="space-y-2">
                <Label>Webhook Secret</Label>
                <div className="flex gap-2">
                  <Input
                    value={createdWebhookSecret}
                    readOnly
                    type="password"
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(createdWebhookSecret)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-amber-600">
                  ⚠️ Save this secret for webhook signature verification. You won't be able to see it again!
                </p>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => {
                    setCreatedWebhookSecret(null)
                    setCreateWebhookDialogOpen(false)
                  }}
                >
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="webhookUrl">Webhook URL</Label>
                <Input
                  id="webhookUrl"
                  placeholder="https://example.com/webhooks"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Events</Label>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {AVAILABLE_EVENTS.map((event) => (
                    <div key={event.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={event.id}
                        checked={selectedEvents.includes(event.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedEvents([...selectedEvents, event.id])
                          } else {
                            setSelectedEvents(selectedEvents.filter((e) => e !== event.id))
                          }
                        }}
                      />
                      <label
                        htmlFor={event.id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {event.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateWebhookDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateWebhook}>Create Webhook</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}