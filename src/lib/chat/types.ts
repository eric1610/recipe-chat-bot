export type MessageRole = 'user' | 'assistant' | 'system';
export type CookingSkill = 'beginner' | 'intermediate' | 'advanced';

export interface ConversationSummary {
	id: string;
	title: string;
	createdAt: string;
	updatedAt: string;
}

export interface StoredConversation extends ConversationSummary {
	archivedAt: string | null;
}

export interface StoredMessage {
	id: string;
	conversationId: string;
	role: MessageRole;
	content: string;
	position: number;
	createdAt: string;
}

export interface ConversationImport {
	conversations: StoredConversation[];
	messages: StoredMessage[];
}

export interface UserPreferences {
	diets: string[];
	allergies: string[];
	dislikedIngredients: string[];
	preferredCuisines: string[];
	cookingSkill: CookingSkill | null;
	householdSize: number | null;
	notes: string;
}

export const emptyPreferences: UserPreferences = {
	diets: [],
	allergies: [],
	dislikedIngredients: [],
	preferredCuisines: [],
	cookingSkill: null,
	householdSize: null,
	notes: ''
};
