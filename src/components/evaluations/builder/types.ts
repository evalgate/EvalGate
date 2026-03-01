import type { EvaluationTemplate } from "@/lib/evaluation-templates";

export interface SelectedTemplate {
	id: string;
	template: EvaluationTemplate;
	config: {
		name?: string;
		description?: string;
		customPrompt?: string;
		customTestCases?: Array<{
			input: string;
			expectedOutput: string;
			rubric: string;
		}>;
		customCriteria?: Array<{
			name: string;
			description: string;
			scale: string;
		}>;
		thresholds?: {
			passingScore?: number;
			warningThreshold?: number;
		};
	};
}

export interface EvaluationBuilderProps {
	onDeploy: (data: {
		name: string;
		description: string;
		type: string;
		templates: SelectedTemplate[];
	}) => void;
}
