"use client"

import { useCustomer } from "autumn-js/react"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export function PlanUsageIndicator() {
  const { customer, isLoading } = useCustomer()

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Usage & Limits</CardTitle>
          <CardDescription>Track your plan usage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!customer) {
    return null
  }

  const currentPlan = customer.products?.[0]?.name || "Developer"
  const tracesFeature = customer.features?.traces
  const projectsFeature = customer.features?.projects

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Usage & Limits</CardTitle>
        <CardDescription>
          Current plan: <span className="font-medium text-foreground">{currentPlan}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Traces Usage */}
        {tracesFeature && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Traces</span>
              <span className="text-muted-foreground">
                {tracesFeature.unlimited ? (
                  "Unlimited"
                ) : (
                  <>
                    {(tracesFeature.usage || 0).toLocaleString()} / {(tracesFeature.included_usage || 0).toLocaleString()}
                  </>
                )}
              </span>
            </div>
            {!tracesFeature.unlimited && (
              <>
                <Progress 
                  value={((tracesFeature.usage || 0) / (tracesFeature.included_usage || 1)) * 100} 
                  className="h-2"
                />
                <p className="text-xs text-muted-foreground">
                  {(tracesFeature.balance || 0).toLocaleString()} traces remaining this month
                </p>
              </>
            )}
          </div>
        )}

        {/* Projects Usage */}
        {projectsFeature && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Projects</span>
              <span className="text-muted-foreground">
                {projectsFeature.unlimited ? (
                  "Unlimited"
                ) : (
                  <>
                    {(projectsFeature.usage || 0).toLocaleString()} / {(projectsFeature.included_usage || 0).toLocaleString()}
                  </>
                )}
              </span>
            </div>
            {!projectsFeature.unlimited && (
              <>
                <Progress 
                  value={((projectsFeature.usage || 0) / (projectsFeature.included_usage || 1)) * 100} 
                  className="h-2"
                />
                <p className="text-xs text-muted-foreground">
                  {projectsFeature.balance} {projectsFeature.balance === 1 ? 'project' : 'projects'} available
                </p>
              </>
            )}
          </div>
        )}

        {/* Upgrade CTA */}
        {currentPlan === "Developer" && (
          <div className="pt-4 border-t">
            <Button asChild className="w-full">
              <Link href="/pricing">
                Upgrade Plan
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}