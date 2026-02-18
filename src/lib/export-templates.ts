/**
 * Template-Specific Export Formatters
 * Adapts export data structure based on evaluation type and category
 */

import type { QualityScore } from "./ai-quality-score";

export type EvaluationType = "unit_test" | "human_eval" | "model_eval" | "ab_test";

export interface BaseExportData {
  evaluation: {
    id: string;
    name: string;
    description: string;
    type: EvaluationType;
    category?: string;
    created_at: string;
  };
  timestamp: string;
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    passRate: string;
  };
  qualityScore: QualityScore;
}

export interface UnitTestExportData extends BaseExportData {
  type: "unit_test";
  testResults: Array<{
    id: string;
    name: string;
    input: any;
    expected_output: any;
    actual_output: any;
    passed: boolean;
    execution_time_ms?: number;
    error_message?: string;
  }>;
  codeValidation?: {
    syntax_errors: number;
    runtime_errors: number;
    assertion_failures: number;
  };
}

export interface HumanEvalExportData extends BaseExportData {
  type: "human_eval";
  evaluations: Array<{
    id: string;
    evaluator_id: string;
    evaluator_name: string;
    test_case_id: string;
    ratings: Record<string, number | string>;
    comments: string;
    timestamp: string;
  }>;
  interRaterReliability?: {
    cohens_kappa?: number;
    fleiss_kappa?: number;
    agreement_percentage: number;
  };
  criteria: Array<{
    name: string;
    description: string;
    scale: string;
    average_score?: number;
  }>;
}

export interface ModelEvalExportData extends BaseExportData {
  type: "model_eval";
  judgeEvaluations: Array<{
    id: string;
    test_case_id: string;
    judge_model: string;
    input: string;
    response: string;
    judgment: {
      label: string;
      score: number;
      reasoning: string;
      metadata?: Record<string, any>;
    };
    timestamp: string;
  }>;
  judgePrompt: string;
  judgeModel: string;
  aggregateMetrics?: {
    average_score: number;
    score_distribution: Record<string, number>;
    common_failure_patterns: string[];
  };
}

export interface ABTestExportData extends BaseExportData {
  type: "ab_test";
  variants: Array<{
    id: string;
    name: string;
    description: string;
    model?: string;
    prompt_template?: string;
    parameters?: Record<string, any>;
  }>;
  results: Array<{
    variant_id: string;
    variant_name: string;
    test_count: number;
    success_rate: number;
    average_latency: number;
    average_cost: number;
    quality_score: number;
  }>;
  statisticalSignificance?: {
    p_value: number;
    confidence_level: number;
    winner?: string;
    effect_size: number;
  };
  comparison: {
    metric: string;
    baseline_variant: string;
    winner_variant?: string;
    improvement_percentage?: number;
  };
}

/**
 * Format export data based on evaluation type
 */
export function formatExportData(
  baseData: BaseExportData,
  additionalData: any,
): UnitTestExportData | HumanEvalExportData | ModelEvalExportData | ABTestExportData {
  const type = baseData.evaluation.type;

  switch (type) {
    case "unit_test":
      return formatUnitTestExport(baseData, additionalData);
    case "human_eval":
      return formatHumanEvalExport(baseData, additionalData);
    case "model_eval":
      return formatModelEvalExport(baseData, additionalData);
    case "ab_test":
      return formatABTestExport(baseData, additionalData);
    default:
      return baseData as any;
  }
}

function formatUnitTestExport(baseData: BaseExportData, additionalData: any): UnitTestExportData {
  return {
    ...baseData,
    type: "unit_test",
    testResults: additionalData.testResults || [],
    codeValidation: additionalData.codeValidation,
  };
}

function formatHumanEvalExport(baseData: BaseExportData, additionalData: any): HumanEvalExportData {
  return {
    ...baseData,
    type: "human_eval",
    evaluations: additionalData.evaluations || [],
    interRaterReliability: additionalData.interRaterReliability,
    criteria: additionalData.criteria || [],
  };
}

function formatModelEvalExport(baseData: BaseExportData, additionalData: any): ModelEvalExportData {
  return {
    ...baseData,
    type: "model_eval",
    judgeEvaluations: additionalData.judgeEvaluations || [],
    judgePrompt: additionalData.judgePrompt || "",
    judgeModel: additionalData.judgeModel || "gpt-4",
    aggregateMetrics: additionalData.aggregateMetrics,
  };
}

function formatABTestExport(baseData: BaseExportData, additionalData: any): ABTestExportData {
  return {
    ...baseData,
    type: "ab_test",
    variants: additionalData.variants || [],
    results: additionalData.results || [],
    statisticalSignificance: additionalData.statisticalSignificance,
    comparison: additionalData.comparison || {
      metric: "quality_score",
      baseline_variant: additionalData.variants?.[0]?.name || "A",
    },
  };
}

/**
 * Generate filename based on evaluation type and category
 */
export function generateExportFilename(
  evaluationName: string,
  type: EvaluationType,
  category?: string,
): string {
  const sanitizedName = evaluationName.replace(/\s+/g, "-").toLowerCase();
  const timestamp = Date.now();

  if (category) {
    return `${type}-${category}-${sanitizedName}-${timestamp}.json`;
  }

  return `${type}-${sanitizedName}-${timestamp}.json`;
}

/**
 * Get export description based on evaluation type
 */
export function getExportDescription(type: EvaluationType): string {
  const descriptions: Record<EvaluationType, string> = {
    unit_test: "Automated test results with code validation metrics",
    human_eval: "Human evaluation ratings with inter-rater reliability",
    model_eval: "LLM judge evaluations with aggregate metrics",
    ab_test: "A/B test results with statistical significance analysis",
  };

  return descriptions[type] || "Evaluation results export";
}

/**
 * Get recommended export format based on evaluation type
 */
export function getRecommendedExportFormat(_type: EvaluationType): "json" | "csv" | "xlsx" {
  // For now, all use JSON, but this can be extended
  return "json";
}

/**
 * Validate export data completeness
 */
export function validateExportData(
  data: UnitTestExportData | HumanEvalExportData | ModelEvalExportData | ABTestExportData,
): { valid: boolean; missingFields: string[] } {
  const missingFields: string[] = [];

  // Check base fields
  if (!data.evaluation?.id) missingFields.push("evaluation.id");
  if (!data.evaluation?.name) missingFields.push("evaluation.name");
  if (!data.qualityScore) missingFields.push("qualityScore");
  if (!data.summary) missingFields.push("summary");

  // Type-specific validation
  switch (data.type) {
    case "unit_test":
      if (!(data as UnitTestExportData).testResults?.length) {
        missingFields.push("testResults");
      }
      break;
    case "human_eval":
      if (!(data as HumanEvalExportData).evaluations?.length) {
        missingFields.push("evaluations");
      }
      if (!(data as HumanEvalExportData).criteria?.length) {
        missingFields.push("criteria");
      }
      break;
    case "model_eval":
      if (!(data as ModelEvalExportData).judgeEvaluations?.length) {
        missingFields.push("judgeEvaluations");
      }
      if (!(data as ModelEvalExportData).judgePrompt) {
        missingFields.push("judgePrompt");
      }
      break;
    case "ab_test":
      if (!(data as ABTestExportData).variants?.length) {
        missingFields.push("variants");
      }
      if (!(data as ABTestExportData).results?.length) {
        missingFields.push("results");
      }
      break;
  }

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}
