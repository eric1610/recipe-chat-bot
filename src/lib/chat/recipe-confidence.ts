export type RecipeConfidenceLevel = 'high' | 'medium' | 'low';

export interface RecipeConfidenceReport {
	level: RecipeConfidenceLevel;
	percentage: number;
}

export function recipeConfidenceLevel(percentage: number): RecipeConfidenceLevel | null {
	if (!Number.isInteger(percentage) || percentage < 0 || percentage > 100) return null;
	if (percentage >= 80) return 'high';
	if (percentage >= 50) return 'medium';
	return 'low';
}

export function parseRecipeConfidenceReport(source: string): RecipeConfidenceReport | null {
	const match = source.match(
		/^\*\*(?:Ingredient|Instruction) accuracy estimate: (High|Medium|Low) \((\d{1,3})%\)\*\*/
	);
	if (!match) return null;

	const percentage = Number(match[2]);
	const level = recipeConfidenceLevel(percentage);
	if (!level || match[1].toLowerCase() !== level) return null;

	return { level, percentage };
}
