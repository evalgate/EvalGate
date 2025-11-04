"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import Link from "next/link"
import { Plus, Beaker, Clock, Search, Filter } from "lucide-react"
import { useSession } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

export default function EvaluationsPage() {
  const { data: session, isPending } = useSession()
  const router = useRouter()
  const [evaluations, setEvaluations] = useState<any[]>([])
  const [filteredEvaluations, setFilteredEvaluations] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")

  useEffect(() => {
    // If not authenticated, load demo data
    if (!isPending && !session?.user) {
      fetch("/api/demo/evaluations")
        .then(res => res.json())
        .then(data => {
          setEvaluations(data.evaluations || [])
          setFilteredEvaluations(data.evaluations || [])
          setIsLoading(false)
        })
        .catch(() => {
          setIsLoading(false)
        })
      return
    }

    if (session?.user) {
      // Add pagination limit
      fetch("/api/evaluations?limit=20&offset=0", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("bearer_token")}`
        }
      })
        .then(res => res.json())
        .then(data => {
          setEvaluations(data.evaluations || [])
          setFilteredEvaluations(data.evaluations || [])
          setIsLoading(false)
        })
        .catch(() => {
          setIsLoading(false)
        })
    }
  }, [session, isPending, router])

  // Filter evaluations based on search and type
  useEffect(() => {
    let filtered = evaluations

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter((evaluation: any) =>
        evaluation.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        evaluation.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Apply type filter
    if (typeFilter !== "all") {
      filtered = filtered.filter((evaluation: any) => evaluation.type === typeFilter)
    }

    setFilteredEvaluations(filtered)
  }, [searchQuery, typeFilter, evaluations])

  if (isPending) {
    return null
  }

  const isDemo = !session?.user

  return (
    <div className="mx-auto max-w-7xl">
      {isDemo && (
        <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-sm text-blue-600 dark:text-blue-400">
            <strong>👁️ Demo Mode:</strong> You're viewing a read-only demo project.{" "}
            <Link href="/auth/sign-up" className="underline font-semibold">
              Sign up
            </Link>{" "}
            to create your own evaluations and duplicate this workspace.
          </p>
        </div>
      )}
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Evaluations</h2>
          <p className="text-muted-foreground text-sm sm:text-base">Create and manage evaluation test suites</p>
        </div>
        <Button asChild size="sm" className="w-full sm:w-auto h-9">
          <Link href="/evaluations/new">
            <Plus className="mr-2 h-4 w-4" />
            New Evaluation
          </Link>
        </Button>
      </div>

      {/* Search and Filters */}
      {!isLoading && evaluations.length > 0 && (
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search evaluations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-[200px] h-10">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="unit_test">Unit Test</SelectItem>
              <SelectItem value="human_eval">Human Eval</SelectItem>
              <SelectItem value="model_eval">Model Eval</SelectItem>
              <SelectItem value="ab_test">A/B Test</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="space-y-3">
                <div className="flex items-start justify-between mb-2">
                  <Skeleton className="h-5 w-24" />
                </div>
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredEvaluations.length > 0 ? (
        <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredEvaluations.map((evaluation: any) => (
            <Link key={evaluation.id} href={`/evaluations/${evaluation.id}`}>
              <Card className="hover:border-primary transition-colors cursor-pointer h-full">
                <CardHeader className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Beaker className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          evaluation.type === "unit_test"
                            ? "bg-blue-500/10 text-blue-500"
                            : evaluation.type === "human_eval"
                              ? "bg-green-500/10 text-green-500"
                              : evaluation.type === "model_eval"
                                ? "bg-purple-500/10 text-purple-500"
                                : "bg-orange-500/10 text-orange-500"
                        }`}
                      >
                        {evaluation.type.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                  <CardTitle className="mt-2 text-base sm:text-lg">{evaluation.name}</CardTitle>
                  <CardDescription className="line-clamp-2 text-sm">
                    {evaluation.description || "No description provided"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground flex-wrap">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(evaluation.created_at).toLocaleDateString()}
                    </div>
                    <div className="truncate">by {evaluation.creator_name || "Unknown"}</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : evaluations.length > 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-10 sm:py-12 px-4">
            <Search className="h-8 w-8 text-muted-foreground mb-3" />
            <h3 className="text-sm sm:text-base font-semibold mb-1">No results found</h3>
            <p className="text-xs sm:text-sm text-muted-foreground mb-4 text-center">
              Try adjusting your search or filters
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("")
                setTypeFilter("all")
              }}
            >
              Clear filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 sm:py-16 px-4">
            <div className="rounded-full bg-primary/10 p-3 sm:p-4 mb-4">
              <Beaker className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold mb-2">No evaluations yet</h3>
            <p className="text-muted-foreground text-center mb-4 sm:mb-6 max-w-sm text-sm sm:text-base px-2">
              Create your first evaluation to start testing your AI models with unit tests, human feedback, or model judges.
            </p>
            <Button asChild size="lg">
              <Link href="/evaluations/new">
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Evaluation
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}