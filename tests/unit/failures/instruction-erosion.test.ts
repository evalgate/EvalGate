import { describe, expect, it } from "vitest";
import {
	detectInstructionErosion,
	generateErosionReport,
	scoreAdherence,
	type Instruction,
	type InstructionObservation,
} from "@/lib/failures/detectors/instruction-erosion";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const now = Date.now();

const POLITE_INSTRUCTION: Instruction = {
	id: "polite",
	description: "Respond politely and professionally",
	adherenceSignals: ["please", "thank you", "kindly", "appreciate"],
	violationSignals: ["stupid", "idiot", "shut up", "you're wrong"],
	importance: 0.8,
};

const CONCISE_INSTRUCTION: Instruction = {
	id: "concise",
	description: "Keep responses under 100 words",
	adherenceSignals: ["brief", "summary", "in short"],
	violationSignals: ["furthermore", "additionally", "moreover", "in conclusion", "to summarize at length"],
	importance: 0.5,
};

function obs(instructionId: string, text: string, offsetMs = 0, manual?: number): InstructionObservation {
	return { instructionId, responseText: text, timestamp: now + offsetMs, manualScore: manual };
}

// ── scoreAdherence ────────────────────────────────────────────────────────────

describe("scoreAdherence — polite instruction", () => {
	it("scores high when adherence signals present", () => {
		const result = scoreAdherence(POLITE_INSTRUCTION, "Thank you for your question, I appreciate your patience.");
		expect(result.score).toBeGreaterThan(0.5);
		expect(result.violated).toBe(false);
	});

	it("scores low when violation signals present", () => {
		const result = scoreAdherence(POLITE_INSTRUCTION, "That's stupid. You're wrong about this.");
		expect(result.score).toBeLessThan(0.5);
		expect(result.violated).toBe(true);
	});

	it("returns neutral score when no signals matched", () => {
		const result = scoreAdherence(POLITE_INSTRUCTION, "The capital of France is Paris.");
		expect(result.score).toBeCloseTo(0.5);
		expect(result.violated).toBe(false);
	});

	it("returns violation evidence", () => {
		const result = scoreAdherence(POLITE_INSTRUCTION, "Shut up and listen to me.");
		expect(result.violationEvidence).toContain("shut up");
	});

	it("returns adherence evidence", () => {
		const result = scoreAdherence(POLITE_INSTRUCTION, "Please review this, and thank you for asking.");
		expect(result.adherenceEvidence.length).toBeGreaterThan(0);
	});

	it("is case-insensitive for signal matching", () => {
		const result = scoreAdherence(POLITE_INSTRUCTION, "THANK YOU for reaching out.");
		expect(result.score).toBeGreaterThan(0.5);
	});
});

// ── detectInstructionErosion — stable adherence ────────────────────────────────

describe("detectInstructionErosion — stable adherence", () => {
	const stableObs = [
		obs("polite", "Thank you for your question, please let me help.", 0),
		obs("polite", "I appreciate your patience, kindly wait.", 1000),
		obs("polite", "Thank you for your message, please proceed.", 2000),
		obs("polite", "I appreciate your concern, kindly note this.", 3000),
		obs("polite", "Please review, and thank you for asking.", 4000),
	];

	it("not flagged as eroding", () => {
		const result = detectInstructionErosion(POLITE_INSTRUCTION, stableObs);
		expect(result.isEroding).toBe(false);
	});

	it("has high mean adherence", () => {
		const result = detectInstructionErosion(POLITE_INSTRUCTION, stableObs);
		expect(result.meanAdherence).toBeGreaterThan(0.6);
	});

	it("severity is none", () => {
		const result = detectInstructionErosion(POLITE_INSTRUCTION, stableObs);
		expect(result.severity).toBe("none");
	});
});

// ── detectInstructionErosion — gradual erosion ───────────────────────────────

describe("detectInstructionErosion — gradual erosion", () => {
	// Scores start high, decline over time
	const erodingObs = [
		obs("polite", "Thank you, please kindly proceed.", 0, 0.95),
		obs("polite", "Here is the answer.", 1000, 0.7),
		obs("polite", "No, that is wrong.", 2000, 0.4),
		obs("polite", "That's incorrect.", 3000, 0.3),
		obs("polite", "You're wrong about this.", 4000, 0.1),
	];

	it("is flagged as eroding", () => {
		const result = detectInstructionErosion(POLITE_INSTRUCTION, erodingObs);
		expect(result.isEroding).toBe(true);
	});

	it("has negative slope", () => {
		const result = detectInstructionErosion(POLITE_INSTRUCTION, erodingObs);
		expect(result.adherenceSlope).toBeLessThan(0);
	});

	it("severity is not none", () => {
		const result = detectInstructionErosion(POLITE_INSTRUCTION, erodingObs);
		expect(result.severity).not.toBe("none");
	});

	it("reports correct observation count", () => {
		const result = detectInstructionErosion(POLITE_INSTRUCTION, erodingObs);
		expect(result.observationCount).toBe(5);
	});
});

// ── detectInstructionErosion — edge cases ────────────────────────────────────

describe("detectInstructionErosion — edge cases", () => {
	it("returns perfect adherence with no observations", () => {
		const result = detectInstructionErosion(POLITE_INSTRUCTION, []);
		expect(result.meanAdherence).toBe(1.0);
		expect(result.isEroding).toBe(false);
	});

	it("filters observations to matching instruction ID only", () => {
		const mixed = [
			obs("polite", "Thank you please.", 0),
			obs("concise", "In short, yes.", 1000),
			obs("polite", "I appreciate this.", 2000),
		];
		const result = detectInstructionErosion(POLITE_INSTRUCTION, mixed);
		expect(result.observationCount).toBe(2);
	});

	it("uses manualScore when provided instead of signal matching", () => {
		const manualObs = [
			obs("polite", "irrelevant text", 0, 0.1),
			obs("polite", "irrelevant text", 1000, 0.15),
			obs("polite", "irrelevant text", 2000, 0.1),
		];
		const result = detectInstructionErosion(POLITE_INSTRUCTION, manualObs);
		expect(result.meanAdherence).toBeLessThan(0.6);
		expect(result.isEroding).toBe(true);
	});

	it("counts violations from low manual scores", () => {
		const lowScoreObs = [
			obs("polite", "text", 0, 0.1),
			obs("polite", "text", 1000, 0.2),
			obs("polite", "text", 2000, 0.9),
		];
		const result = detectInstructionErosion(POLITE_INSTRUCTION, lowScoreObs);
		expect(result.violationCount).toBe(2);
	});

	it("does not compute slope with fewer than minObservations", () => {
		const twoObs = [
			obs("polite", "text", 0, 0.5),
			obs("polite", "text", 1000, 0.2),
		];
		const result = detectInstructionErosion(POLITE_INSTRUCTION, twoObs, { minObservationsForSlope: 3 });
		expect(result.adherenceSlope).toBe(0);
	});
});

// ── generateErosionReport ─────────────────────────────────────────────────────

describe("generateErosionReport", () => {
	const INSTRUCTIONS = [POLITE_INSTRUCTION, CONCISE_INSTRUCTION];

	const goodObs: InstructionObservation[] = [
		obs("polite", "Thank you please kindly.", 0, 0.9),
		obs("polite", "I appreciate your patience.", 1000, 0.9),
		obs("polite", "Please review this, kindly.", 2000, 0.85),
		obs("concise", "In short, yes.", 0, 0.9),
		obs("concise", "Brief answer: no.", 1000, 0.85),
		obs("concise", "Summary: approved.", 2000, 0.9),
	];

	it("returns no eroding instructions when adherence is high", () => {
		const report = generateErosionReport(INSTRUCTIONS, goodObs);
		expect(report.erodingInstructions).toHaveLength(0);
	});

	it("does not trigger alert when adherence is high", () => {
		const report = generateErosionReport(INSTRUCTIONS, goodObs);
		expect(report.alertTriggered).toBe(false);
	});

	it("triggers alert when erosion index exceeds threshold", () => {
		const badObs: InstructionObservation[] = [
			obs("polite", "t", 0, 0.1),
			obs("polite", "t", 1000, 0.1),
			obs("polite", "t", 2000, 0.1),
			obs("concise", "t", 0, 0.1),
			obs("concise", "t", 1000, 0.1),
			obs("concise", "t", 2000, 0.1),
		];
		const report = generateErosionReport(INSTRUCTIONS, badObs, { alertThreshold: 0.2 });
		expect(report.alertTriggered).toBe(true);
		expect(report.overallErosionIndex).toBeGreaterThan(0);
	});

	it("includes all instructions in report", () => {
		const report = generateErosionReport(INSTRUCTIONS, goodObs);
		expect(report.instructions).toHaveLength(2);
	});

	it("eroding instructions sorted by severity descending", () => {
		const mixedObs: InstructionObservation[] = [
			// polite severely eroding
			obs("polite", "t", 0, 0.1),
			obs("polite", "t", 1000, 0.1),
			obs("polite", "t", 2000, 0.05),
			// concise mildly eroding
			obs("concise", "t", 0, 0.55),
			obs("concise", "t", 1000, 0.52),
			obs("concise", "t", 2000, 0.48),
		];
		const report = generateErosionReport(INSTRUCTIONS, mixedObs, { alertThreshold: 0.05 });
		if (report.erodingInstructions.length >= 2) {
			const sev: Record<string, number> = { severe: 3, moderate: 2, mild: 1, none: 0 };
			const first = sev[report.erodingInstructions[0]!.severity] ?? 0;
			const second = sev[report.erodingInstructions[1]!.severity] ?? 0;
			expect(first).toBeGreaterThanOrEqual(second);
		}
	});

	it("returns 0 erosion index with no observations", () => {
		const report = generateErosionReport(INSTRUCTIONS, []);
		expect(report.overallErosionIndex).toBe(0);
	});
});
