/**
 * Inter-Annotator Agreement (IAA) Module
 * Computes Cohen's Kappa (2 raters) and Fleiss's Kappa (3+ raters).
 */

export interface AnnotationRecord {
	/** Item/test-case identifier */
	itemId: string | number;
	/** Annotator identifier */
	annotatorId: string;
	/** Categorical rating (used for agreement) */
	category: string | number;
}

export interface IAAResult {
	/** Cohen's Kappa (when exactly 2 annotators) */
	cohensKappa?: number;
	/** Fleiss's Kappa (when 3+ annotators) */
	fleissKappa?: number;
	/** Raw agreement percentage (all raters) */
	agreementPercentage: number;
	/** Number of items with multiple annotations */
	itemCount: number;
	/** Number of annotators */
	annotatorCount: number;
}

/**
 * Compute Cohen's Kappa for two raters.
 * κ = (p_o - p_e) / (1 - p_e)
 */
export function cohensKappa(
	pairs: Array<{ rater1: string | number; rater2: string | number }>,
): number {
	if (pairs.length === 0) return 0;

	const categories = new Set<string>();
	pairs.forEach((p) => {
		categories.add(String(p.rater1));
		categories.add(String(p.rater2));
	});
	const catList = Array.from(categories);
	const n = pairs.length;

	// Build contingency matrix: rows = rater1, cols = rater2
	const matrix: Record<string, Record<string, number>> = {};
	catList.forEach((c) => {
		matrix[c] = {};
		catList.forEach((d) => (matrix[c][d] = 0));
	});

	pairs.forEach(({ rater1, rater2 }) => {
		const r1 = String(rater1);
		const r2 = String(rater2);
		const row = matrix[r1];
		if (row && r2 in row) row[r2]++;
	});

	// p_o = observed agreement
	let diagonalSum = 0;
	catList.forEach((c) => {
		if (matrix[c] && matrix[c][c] !== undefined) diagonalSum += matrix[c][c];
	});
	const p_o = diagonalSum / n;

	// p_e = expected agreement by chance
	const marginal1: Record<string, number> = {};
	const marginal2: Record<string, number> = {};
	catList.forEach((c) => {
		marginal1[c] = 0;
		marginal2[c] = 0;
	});
	pairs.forEach(({ rater1, rater2 }) => {
		marginal1[String(rater1)]++;
		marginal2[String(rater2)]++;
	});
	let p_e = 0;
	catList.forEach((c) => {
		p_e += (marginal1[c] / n) * (marginal2[c] / n);
	});

	if (p_e >= 1) return 0;
	return (p_o - p_e) / (1 - p_e);
}

/**
 * Compute Fleiss's Kappa for multiple raters.
 * κ = (P_bar - p_e) / (1 - p_e)
 */
export function fleissKappa(matrix: Array<Record<string, number>>): number {
	if (matrix.length === 0) return 0;

	const categories = new Set<string>();
	matrix.forEach((row) => {
		Object.keys(row).forEach((k) => categories.add(k));
	});
	const catList = Array.from(categories);
	const N = matrix.length;

	let n = 0; // raters per subject (assumed constant)
	matrix.forEach((row) => {
		const total = Object.values(row).reduce((a, b) => a + b, 0);
		if (n === 0) n = total;
	});
	if (n < 2) return 0;

	// P_i for each subject
	const P: number[] = [];
	matrix.forEach((row) => {
		let sum = 0;
		catList.forEach((c) => {
			const n_ij = row[c] ?? 0;
			sum += n_ij * (n_ij - 1);
		});
		P.push(sum / (n * (n - 1)));
	});
	const P_bar = P.reduce((a, b) => a + b, 0) / N;

	// p_j = proportion of assignments to category j
	const p_j: Record<string, number> = {};
	catList.forEach((c) => (p_j[c] = 0));
	matrix.forEach((row) => {
		catList.forEach((c) => {
			p_j[c] += row[c] ?? 0;
		});
	});
	const totalAssignments = N * n;
	catList.forEach((c) => {
		p_j[c] /= totalAssignments;
	});

	const p_e = catList.reduce((sum, c) => sum + p_j[c] * p_j[c], 0);
	if (p_e >= 1) return 0;
	return (P_bar - p_e) / (1 - p_e);
}

/**
 * Compute IAA from annotation records.
 * Groups by itemId, extracts category from rating or labels.
 */
export function computeIAA(annotations: AnnotationRecord[]): IAAResult {
	const byItem = new Map<
		string | number,
		Array<{ annotatorId: string; category: string | number }>
	>();
	const annotators = new Set<string>();

	annotations.forEach((a) => {
		const cat = a.category;
		if (cat === null || cat === undefined || cat === "") return;
		const _key = String(cat);
		if (!byItem.has(a.itemId)) byItem.set(a.itemId, []);
		byItem
			.get(a.itemId)
			?.push({ annotatorId: a.annotatorId, category: String(cat) });
		annotators.add(a.annotatorId);
	});

	const multiAnnotatorItems = Array.from(byItem.values()).filter(
		(arr) => arr.length >= 2,
	);
	const itemCount = multiAnnotatorItems.length;
	const annotatorCount = annotators.size;

	if (itemCount === 0) {
		return { agreementPercentage: 0, itemCount: 0, annotatorCount };
	}

	// Agreement percentage: for each item, count pairs that agree
	let totalPairs = 0;
	let agreeingPairs = 0;
	multiAnnotatorItems.forEach((arr) => {
		const catCounts: Record<string, number> = {};
		arr.forEach(({ category }) => {
			catCounts[category] = (catCounts[category] ?? 0) + 1;
		});
		const n = arr.length;
		totalPairs += (n * (n - 1)) / 2;
		Object.values(catCounts).forEach((c) => {
			agreeingPairs += (c * (c - 1)) / 2;
		});
	});
	const agreementPercentage = totalPairs > 0 ? agreeingPairs / totalPairs : 0;

	let cohensKappaVal: number | undefined;
	let fleissKappaVal: number | undefined;

	if (annotatorCount === 2) {
		const pairs: Array<{ rater1: string; rater2: string }> = [];
		multiAnnotatorItems.forEach((arr) => {
			if (arr.length === 2) {
				pairs.push({
					rater1: String(arr[0].category),
					rater2: String(arr[1].category),
				});
			}
		});
		cohensKappaVal = pairs.length > 0 ? cohensKappa(pairs) : undefined;
	} else if (annotatorCount >= 3) {
		const matrix: Array<Record<string, number>> = [];
		multiAnnotatorItems.forEach((arr) => {
			const row: Record<string, number> = {};
			arr.forEach(({ category }) => {
				const key = String(category);
				row[key] = (row[key] ?? 0) + 1;
			});
			matrix.push(row);
		});
		fleissKappaVal = matrix.length > 0 ? fleissKappa(matrix) : undefined;
	}

	return {
		cohensKappa: cohensKappaVal,
		fleissKappa: fleissKappaVal,
		agreementPercentage,
		itemCount,
		annotatorCount,
	};
}
