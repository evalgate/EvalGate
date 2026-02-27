/**
 * evalai print-config — Show resolved configuration with source-of-truth annotations.
 *
 * Prints every config field, where it came from (file, env, default, CLI arg),
 * and redacts secrets. Useful for debugging "why is it using this baseUrl?"
 *
 * Usage:
 *   evalai print-config
 *   evalai print-config --format json
 *
 * Exit codes:
 *   0 — Always (informational only)
 */
type Source = "file" | "env" | "default" | "profile" | "arg";
interface ResolvedField {
    key: string;
    value: string | number | boolean | null;
    source: Source;
    raw?: string;
}
export interface PrintConfigOutput {
    cliVersion: string;
    configFile: string | null;
    cwd: string;
    resolved: ResolvedField[];
    env: Record<string, string | null>;
}
export declare function runPrintConfig(argv: string[]): number;
export {};
