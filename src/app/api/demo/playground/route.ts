/**
 * Demo Playground API
 * Provides pre-populated demo data for interactive playground
 * No authentication required - public endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { calculateQualityScore } from '@/lib/ai-quality-score';

export const runtime = 'edge';

interface DemoScenario {
  id: string;
  name: string;
  description: string;
  template: string;
  results: any;
  qualityScore: any;
}

/**
 * GET /api/demo/playground
 * Returns available demo scenarios
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const scenarioId = searchParams.get('scenario');

  if (scenarioId) {
    const scenario = getDemoScenario(scenarioId);
    if (!scenario) {
      return NextResponse.json(
        { error: 'Scenario not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(scenario);
  }

  // Return list of available scenarios
  const scenarios = [
    {
      id: 'chatbot-accuracy',
      name: 'Chatbot Accuracy Test',
      description: 'See how well a customer service chatbot handles common questions',
      icon: '💬',
      estimatedTime: '30 seconds',
      difficulty: 'Beginner'
    },
    {
      id: 'rag-hallucination',
      name: 'RAG Hallucination Detection',
      description: 'Detect when AI makes up information not in the source documents',
      icon: '🔍',
      estimatedTime: '45 seconds',
      difficulty: 'Intermediate'
    },
    {
      id: 'code-quality',
      name: 'Code Generation Quality',
      description: 'Evaluate if generated code actually works and follows best practices',
      icon: '💻',
      estimatedTime: '1 minute',
      difficulty: 'Advanced'
    }
  ];

  return NextResponse.json({ scenarios });
}

/**
 * POST /api/demo/playground
 * Runs a demo evaluation and returns results
 */
export async function POST(request: NextRequest) {
  try {
    const { scenario } = await request.json();

    if (!scenario) {
      return NextResponse.json(
        { error: 'Scenario is required' },
        { status: 400 }
      );
    }

    const demoScenario = getDemoScenario(scenario);
    if (!demoScenario) {
      return NextResponse.json(
        { error: 'Invalid scenario' },
        { status: 400 }
      );
    }

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1500));

    return NextResponse.json({
      success: true,
      scenario: demoScenario,
      message: 'Evaluation complete! Sign up to save and share your results.'
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Get pre-populated demo scenario data
 */
function getDemoScenario(id: string): DemoScenario | null {
  const scenarios: Record<string, DemoScenario> = {
    'chatbot-accuracy': {
      id: 'chatbot-accuracy',
      name: 'Customer Service Chatbot',
      description: 'Testing a chatbot that handles customer inquiries',
      template: 'chatbot-accuracy',
      results: {
        totalTests: 10,
        passed: 8,
        failed: 2,
        tests: [
          {
            id: 1,
            input: 'What are your business hours?',
            expected: 'Monday-Friday, 9am-5pm EST',
            actual: 'We\'re open Monday through Friday, 9am to 5pm Eastern Time.',
            status: 'passed',
            score: 95,
            notes: 'Accurate and well-formatted response'
          },
          {
            id: 2,
            input: 'How do I reset my password?',
            expected: 'Click "Forgot Password" and follow email instructions',
            actual: 'To reset your password, click the "Forgot Password" link on the login page. You\'ll receive an email with instructions.',
            status: 'passed',
            score: 98,
            notes: 'Excellent detail and clarity'
          },
          {
            id: 3,
            input: 'What is your refund policy?',
            expected: '30-day money-back guarantee',
            actual: 'We offer a 30-day money-back guarantee on all purchases.',
            status: 'passed',
            score: 100,
            notes: 'Perfect response'
          },
          {
            id: 4,
            input: 'Do you ship internationally?',
            expected: 'Yes, to most countries',
            actual: 'Yes! We ship to over 150 countries worldwide.',
            status: 'passed',
            score: 92,
            notes: 'Good detail, could mention exceptions'
          },
          {
            id: 5,
            input: 'Can I change my order after placing it?',
            expected: 'Contact support within 1 hour',
            actual: 'Please contact our support team as soon as possible. If your order hasn\'t been processed yet, we can make changes.',
            status: 'passed',
            score: 88,
            notes: 'Helpful but could be more specific about timeframe'
          },
          {
            id: 6,
            input: 'What payment methods do you accept?',
            expected: 'Credit cards, PayPal, Apple Pay',
            actual: 'We accept all major credit cards, PayPal, Apple Pay, and Google Pay.',
            status: 'passed',
            score: 96,
            notes: 'Comprehensive list'
          },
          {
            id: 7,
            input: 'How long does shipping take?',
            expected: '3-5 business days domestic, 7-14 international',
            actual: 'Shipping typically takes 5-7 business days.',
            status: 'failed',
            score: 65,
            notes: 'Missing international shipping timeframe'
          },
          {
            id: 8,
            input: 'Do you have a mobile app?',
            expected: 'Yes, on iOS and Android',
            actual: 'Yes! Our app is available on both iOS and Android. Search for "CompanyName" in your app store.',
            status: 'passed',
            score: 94,
            notes: 'Helpful with download instructions'
          },
          {
            id: 9,
            input: 'What if my product arrives damaged?',
            expected: 'Contact support for free replacement',
            actual: 'We\'ll send a replacement at no cost. Please email photos to support@company.com.',
            status: 'passed',
            score: 90,
            notes: 'Clear instructions, good response'
          },
          {
            id: 10,
            input: 'Can I track my order?',
            expected: 'Yes, via tracking link in email',
            actual: 'You can track your package using the link in your shipping confirmation email.',
            status: 'failed',
            score: 70,
            notes: 'Should mention what to do if email not received'
          }
        ]
      },
      qualityScore: calculateQualityScore({
        totalEvaluations: 10,
        passedEvaluations: 8,
        failedEvaluations: 2,
        averageLatency: 450,
        averageCost: 0.002,
        averageScore: 88.8,
        consistencyScore: 85
      })
    },

    'rag-hallucination': {
      id: 'rag-hallucination',
      name: 'Product Documentation RAG',
      description: 'Testing RAG system for hallucinations in product docs',
      template: 'rag-hallucination',
      results: {
        totalTests: 8,
        passed: 6,
        failed: 2,
        tests: [
          {
            id: 1,
            query: 'What is the warranty period?',
            context: 'All products come with a standard 1-year manufacturer warranty.',
            actual: 'The warranty period is 1 year.',
            status: 'passed',
            hallucinated: false,
            score: 100,
            notes: 'Accurate, directly from context'
          },
          {
            id: 2,
            query: 'How do I contact support?',
            context: 'Contact our support team at support@company.com or call 1-800-555-0123.',
            actual: 'You can contact support at support@company.com or call 1-800-555-0123.',
            status: 'passed',
            hallucinated: false,
            score: 100,
            notes: 'Perfect extraction from context'
          },
          {
            id: 3,
            query: 'What is the return window?',
            context: 'Returns are accepted within 30 days of purchase.',
            actual: 'You have 30 days to return your purchase.',
            status: 'passed',
            hallucinated: false,
            score: 100,
            notes: 'Accurately stated'
          },
          {
            id: 4,
            query: 'Is there free shipping?',
            context: 'Free shipping on orders over $50.',
            actual: 'Yes, free shipping is available on all orders over $50.',
            status: 'passed',
            hallucinated: false,
            score: 100,
            notes: 'Correctly extracted threshold'
          },
          {
            id: 5,
            query: 'What payment methods are accepted?',
            context: 'We accept Visa, Mastercard, and PayPal.',
            actual: 'We accept Visa, Mastercard, PayPal, and American Express.',
            status: 'failed',
            hallucinated: true,
            score: 0,
            notes: '⚠️ Added American Express - not in context!'
          },
          {
            id: 6,
            query: 'Do you ship internationally?',
            context: 'We currently ship within the United States only.',
            actual: 'Currently we only ship within the United States.',
            status: 'passed',
            hallucinated: false,
            score: 100,
            notes: 'Accurate limitation stated'
          },
          {
            id: 7,
            query: 'What is the price?',
            context: 'Product starts at $49.99.',
            actual: 'The product is available starting at $39.99.',
            status: 'failed',
            hallucinated: true,
            score: 0,
            notes: '⚠️ Wrong price - hallucinated $39.99 instead of $49.99'
          },
          {
            id: 8,
            query: 'Is assembly required?',
            context: 'No assembly required - ready to use out of the box.',
            actual: 'No assembly is required. It\'s ready to use immediately.',
            status: 'passed',
            hallucinated: false,
            score: 100,
            notes: 'Correctly paraphrased'
          }
        ]
      },
      qualityScore: calculateQualityScore({
        totalEvaluations: 8,
        passedEvaluations: 6,
        failedEvaluations: 2,
        averageLatency: 650,
        averageCost: 0.003,
        averageScore: 75,
        consistencyScore: 78
      })
    },

    'code-quality': {
      id: 'code-quality',
      name: 'Code Generation Quality',
      description: 'Testing if generated code is correct and follows best practices',
      template: 'code-correctness',
      results: {
        totalTests: 6,
        passed: 5,
        failed: 1,
        tests: [
          {
            id: 1,
            task: 'Write a function to reverse a string',
            generated: 'function reverse(str: string): string {\n  return str.split(\"\").reverse().join(\"\");\n}',
            status: 'passed',
            testsRun: 5,
            testsPassed: 5,
            score: 100,
            notes: 'Clean, efficient implementation'
          },
          {
            id: 2,
            task: 'Create a function to check if a number is prime',
            generated: 'function isPrime(n: number): boolean {\n  if (n <= 1) return false;\n  for (let i = 2; i <= Math.sqrt(n); i++) {\n    if (n % i === 0) return false;\n  }\n  return true;\n}',
            status: 'passed',
            testsRun: 8,
            testsPassed: 8,
            score: 98,
            notes: 'Efficient algorithm with edge cases handled'
          },
          {
            id: 3,
            task: 'Write a function to calculate factorial',
            generated: 'function factorial(n: number): number {\n  if (n <= 1) return 1;\n  return n * factorial(n - 1);\n}',
            status: 'passed',
            testsRun: 5,
            testsPassed: 5,
            score: 95,
            notes: 'Recursive solution works, could add memoization'
          },
          {
            id: 4,
            task: 'Create a function to find unique values in array',
            generated: 'function unique<T>(arr: T[]): T[] {\n  return [...new Set(arr)];\n}',
            status: 'passed',
            testsRun: 6,
            testsPassed: 6,
            score: 100,
            notes: 'Perfect use of Set, generic typing'
          },
          {
            id: 5,
            task: 'Write a function to debounce another function',
            generated: 'function debounce(fn: Function, delay: number) {\n  let timeout: NodeJS.Timeout;\n  return (...args: any[]) => {\n    clearTimeout(timeout);\n    timeout = setTimeout(() => fn(...args), delay);\n  };\n}',
            status: 'passed',
            testsRun: 4,
            testsPassed: 4,
            score: 92,
            notes: 'Works correctly, could improve typing'
          },
          {
            id: 6,
            task: 'Create a function to deep clone an object',
            generated: 'function deepClone(obj: any): any {\n  return JSON.parse(JSON.stringify(obj));\n}',
            status: 'failed',
            testsRun: 7,
            testsPassed: 4,
            score: 60,
            notes: '⚠️ Fails on Date objects, functions, and circular references'
          }
        ]
      },
      qualityScore: calculateQualityScore({
        totalEvaluations: 6,
        passedEvaluations: 5,
        failedEvaluations: 1,
        averageLatency: 1200,
        averageCost: 0.005,
        averageScore: 90.8,
        consistencyScore: 82
      })
    }
  };

  return scenarios[id] || null;
}

