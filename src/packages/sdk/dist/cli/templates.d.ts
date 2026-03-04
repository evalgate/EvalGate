/**
 * evalgate init --template — Starter templates with real working evals
 *
 * Templates:
 *   chatbot   — Conversational AI quality + safety checks
 *   codegen   — Code generation accuracy + syntax validation
 *   agent     — Multi-step agent tool-use evaluation
 *   safety    — PII, toxicity, and hallucination guards
 *   rag       — Retrieval-augmented generation faithfulness
 */
export type TemplateName = "chatbot" | "codegen" | "agent" | "safety" | "rag";
export declare const TEMPLATE_DESCRIPTIONS: Record<TemplateName, string>;
export declare const AVAILABLE_TEMPLATES: TemplateName[];
/**
 * Install a template into the project
 */
export declare function installTemplate(template: TemplateName, cwd?: string): {
    filesCreated: string[];
    filesSkipped: string[];
};
/**
 * Print available templates
 */
export declare function printTemplateList(): void;
