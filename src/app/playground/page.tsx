/**
 * Interactive Playground Page
 * Public page - no authentication required
 * Try AI evaluations in < 30 seconds
 */

'use client';

import { InteractivePlayground } from '@/components/interactive-playground';

export default function PlaygroundPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">EvalAI</span>
              <span className="text-sm text-muted-foreground">/ Playground</span>
            </div>
            <div className="flex items-center gap-4">
              <a href="/auth/login" className="text-sm hover:underline">
                Sign In
              </a>
              <a 
                href="/auth/sign-up" 
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
              >
                Start Free Trial
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Playground */}
      <main className="container mx-auto px-4 py-12">
        <InteractivePlayground
          onSignupPrompt={() => {
            window.location.href = '/auth/sign-up?source=playground';
          }}
        />
      </main>

      {/* Footer */}
      <footer className="border-t mt-24">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div>© 2024 EvalAI. All rights reserved.</div>
            <div className="flex gap-6">
              <a href="/documentation" className="hover:underline">
                Documentation
              </a>
              <a href="/pricing" className="hover:underline">
                Pricing
              </a>
              <a href="/contact" className="hover:underline">
                Contact
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

