/**
 * evalai doctor — Verify CI/CD setup.
 * Uses the same quality endpoint as check — if doctor passes, check works.
 */
export type DoctorArgs = {
    baseUrl: string;
    apiKey: string;
    evaluationId: string;
    baseline: 'published' | 'previous' | 'production';
};
export declare function runDoctor(argv: string[]): Promise<number>;
