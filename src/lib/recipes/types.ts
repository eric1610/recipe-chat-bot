export interface RecipeFacts {
	title: string;
	yield: string | null;
	prepTime: string | null;
	cookTime: string | null;
	totalTime: string | null;
	cuisines: string[];
	categories: string[];
	ingredients: string[];
	instructions: string[];
}

export interface StoredRecipeCandidate {
	id: string;
	title: string;
	domain: string;
	url: string;
	snippet: string;
	approved: boolean;
	sourceKey: string;
	facts: RecipeFacts | null;
}

export interface RecipeCandidateView {
	id: string;
	title: string;
	domain: string;
	url: string;
	snippet: string;
	approved: boolean;
}

export interface PendingRecipeSearchView {
	id: string;
	assistantMessageId: string;
	status: 'pending' | 'selected' | 'expired';
	selectedCandidateId: string | null;
	expiresAt: string;
	candidates: RecipeCandidateView[];
}
