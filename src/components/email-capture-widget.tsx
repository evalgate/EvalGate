/**
 * Email Capture Widget
 * Captures emails after impressive demo results
 * High-converting design with clear value proposition
 */

'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Mail, CheckCircle2, Sparkles, TrendingUp, BookOpen } from 'lucide-react';
import { toast } from 'sonner';

interface EmailCaptureWidgetProps {
  source?: string;
  context?: Record<string, any>;
  onSuccess?: () => void;
}

export function EmailCaptureWidget({ 
  source = 'playground', 
  context = {},
  onSuccess 
}: EmailCaptureWidgetProps) {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !isValidEmail(email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          source,
          context,
          subscribedAt: new Date().toISOString()
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to subscribe');
      }

      setIsSuccess(true);
      toast.success('Success! Check your email 📧');
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
        <CardContent className="py-8">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="bg-green-500/20 p-3 rounded-full">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-2">You're all set! 🎉</h3>
              <p className="text-muted-foreground">
                Check your inbox for your evaluation results and weekly AI quality tips.
              </p>
            </div>
            <div className="flex justify-center gap-4 pt-4">
              <Button asChild variant="outline">
                <a href="/templates">Browse Templates</a>
              </Button>
              <Button asChild>
                <a href="/auth/sign-up">Start Free Trial</a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
      <CardContent className="py-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="flex justify-center">
              <div className="bg-primary/20 p-3 rounded-full">
                <Mail className="h-6 w-6 text-primary" />
              </div>
            </div>
            <h3 className="text-2xl font-bold">Want these results emailed to you?</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Get this evaluation report + weekly AI quality tips delivered to your inbox
            </p>
          </div>

          {/* Benefits */}
          <div className="grid md:grid-cols-3 gap-4 py-4">
            <BenefitItem
              icon={<Sparkles className="h-5 w-5" />}
              title="Your Results"
              description="PDF report of this evaluation"
            />
            <BenefitItem
              icon={<BookOpen className="h-5 w-5" />}
              title="Weekly Templates"
              description="New evaluation templates every Tuesday"
            />
            <BenefitItem
              icon={<TrendingUp className="h-5 w-5" />}
              title="Quality Tips"
              description="Expert advice from our team"
            />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-4">
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                className="flex-1"
                required
              />
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="min-w-[120px]"
              >
                {isSubmitting ? 'Sending...' : 'Get Results'}
              </Button>
            </div>
            <p className="text-xs text-center text-muted-foreground">
              5,000+ developers already subscribed. Unsubscribe anytime.
            </p>
          </form>

          {/* Trust Signals */}
          <div className="flex items-center justify-center gap-6 pt-4 border-t">
            <TrustSignal text="No spam" />
            <TrustSignal text="Unsubscribe anytime" />
            <TrustSignal text="100% free" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BenefitItem({ 
  icon, 
  title, 
  description 
}: { 
  icon: React.ReactNode; 
  title: string; 
  description: string;
}) {
  return (
    <div className="text-center space-y-2">
      <div className="flex justify-center text-primary">
        {icon}
      </div>
      <div>
        <div className="font-semibold text-sm">{title}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </div>
  );
}

function TrustSignal({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <CheckCircle2 className="h-3 w-3 text-green-500" />
      {text}
    </div>
  );
}

function isValidEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

