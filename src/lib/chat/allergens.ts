function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsAllergen(value: string, terms: string[]): boolean {
	return terms.some((term) => {
		const normalized = term.normalize('NFKC').trim();
		if (!normalized) return false;
		return new RegExp(
			`(?:^|[^\\p{L}\\p{N}])${escapeRegExp(normalized)}(?:$|[^\\p{L}\\p{N}])`,
			'iu'
		).test(value.normalize('NFKC'));
	});
}

/** Add deterministic warnings only to bullet items inside a Markdown Ingredients section. */
export function annotateRecipeAllergens(source: string, terms: string[]): string {
	if (terms.length === 0) return source;
	let inIngredients = false;

	return source
		.split('\n')
		.map((line) => {
			const heading = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/u);
			if (heading) {
				inIngredients = /^ingredients$/iu.test(heading[2]);
				return line;
			}
			if (!inIngredients) return line;

			const item = line.match(/^(\s*[-+*]\s+)(.+)$/u);
			if (!item || /^⚠️\s+Possible allergen:/iu.test(item[2])) return line;
			if (!containsAllergen(item[2], terms)) return line;

			const ingredient = item[2].replaceAll('**', '').trim();
			return `${item[1]}⚠️ Possible allergen: **${ingredient}**`;
		})
		.join('\n');
}
