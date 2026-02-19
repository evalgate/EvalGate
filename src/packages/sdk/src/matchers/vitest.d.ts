import type { OpenAIChatEvalResult } from "../integrations/openai-eval";

declare module "vitest" {
  interface Assertion<T = unknown> {
    toPassGate(): T extends OpenAIChatEvalResult ? void : never;
  }
}
