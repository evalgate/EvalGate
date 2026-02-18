// Core domain types for the AI Evaluation Platform

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// User and Organization Types
export interface User {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: "owner" | "admin" | "member" | "viewer";
  created_at: string;
}

// Evaluation Types
export type EvaluationType = "unit_test" | "human_eval" | "model_eval" | "ab_test";
export type EvaluationStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface Evaluation {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  type: EvaluationType;
  config: Json;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface EvaluationRun {
  id: string;
  evaluation_id: string;
  status: EvaluationStatus;
  started_at: string;
  completed_at?: string;
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  metrics: Json;
  error_message?: string;
  created_by: string;
}

// Trace Types
export interface Trace {
  id: string;
  organization_id: string;
  session_id?: string;
  name: string;
  metadata: Json;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface Span {
  id: string;
  trace_id: string;
  parent_span_id?: string;
  name: string;
  span_type: "llm" | "tool" | "agent" | "retrieval" | "custom";
  start_time: string;
  end_time?: string;
  duration_ms?: number;
  input: Json;
  output?: Json;
  metadata: Json;
  error?: string;
  created_at: string;
}

// Test Case Types
export interface TestCase {
  id: string;
  evaluation_id: string;
  name: string;
  input: Json;
  expected_output?: Json;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface TestResult {
  id: string;
  evaluation_run_id: string;
  test_case_id: string;
  status: "passed" | "failed" | "skipped";
  actual_output: Json;
  assertions: AssertionResult[];
  duration_ms: number;
  error_message?: string;
  trace_id?: string;
  created_at: string;
}

export interface AssertionResult {
  name: string;
  passed: boolean;
  expected: Json;
  actual: Json;
  message?: string;
}

// Human Evaluation Types
export interface HumanAnnotation {
  id: string;
  evaluation_run_id: string;
  test_case_id: string;
  annotator_id: string;
  rating?: number;
  feedback?: string;
  labels: Json;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface AnnotationTask {
  id: string;
  evaluation_run_id: string;
  test_case_id: string;
  assigned_to?: string;
  status: "pending" | "in_progress" | "completed" | "skipped";
  priority: number;
  created_at: string;
  updated_at: string;
}

// LLM Judge Types
export interface LLMJudgeResult {
  id: string;
  evaluation_run_id: string;
  test_case_id: string;
  judge_model: string;
  score: number;
  reasoning: string;
  criteria: Json;
  metadata: Json;
  created_at: string;
}

// A/B Test Types
export interface ABTest {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  variant_a_id: string;
  variant_b_id: string;
  traffic_split: number;
  status: "draft" | "running" | "paused" | "completed";
  start_date?: string;
  end_date?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ABTestVariant {
  id: string;
  ab_test_id: string;
  name: string;
  config: Json;
  created_at: string;
}

export interface ABTestResult {
  id: string;
  ab_test_id: string;
  variant_id: string;
  user_id?: string;
  session_id: string;
  outcome: Json;
  metrics: Json;
  created_at: string;
}

// Metrics Types
export interface Metric {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  metric_type: "accuracy" | "latency" | "cost" | "custom";
  aggregation: "avg" | "sum" | "min" | "max" | "p50" | "p95" | "p99";
  config: Json;
  created_at: string;
}

export interface MetricValue {
  id: string;
  metric_id: string;
  evaluation_run_id?: string;
  value: number;
  dimensions: Json;
  timestamp: string;
}
