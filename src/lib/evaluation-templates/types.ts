import type React from "react";

export interface EvaluationTemplate {
  id: string;
  name: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  type: "unit_test" | "human_eval" | "model_eval" | "ab_test";
  complexity: "beginner" | "intermediate" | "advanced";
  testCases: Array<{
    input: string;
    expectedOutput: string;
    rubric: string;
  }>;
  judgePrompt?: string;
  humanEvalCriteria?: Array<{
    name: string;
    description: string;
    scale: string;
  }>;
  code?: string;
}
