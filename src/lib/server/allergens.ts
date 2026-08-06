import { sanitizeMessageContent } from '$lib/chat/content';
import type { Database } from '$lib/server/db';
import {
	allergenCatalog,
	userAllergies,
	type UserAllergySource
} from '$lib/server/db/schema';
import { asc, eq } from 'drizzle-orm';

export const MAX_USER_ALLERGIES = 30;
export const MAX_ALLERGEN_NAME_CHARACTERS = 100;

interface CatalogAllergen {
	slug: string;
	name: string;
	aliases: string[];
}

interface NormalizedAllergy {
	normalizedName: string;
	displayName: string;
	catalogSlug: string | null;
}

export function normalizeAllergenName(value: string): string {
	return sanitizeMessageContent(value)
		.normalize('NFKC')
		.toLocaleLowerCase('en-CA')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, MAX_ALLERGEN_NAME_CHARACTERS);
}

function cleanDeclaredItem(value: string): string {
	return sanitizeMessageContent(value)
		.replace(/^(?:both|either|the)\s+/i, '')
		.replace(/\s+(?:but|so|because)\s+.*$/i, '')
		.trim()
		.slice(0, MAX_ALLERGEN_NAME_CHARACTERS);
}

/** Extract only direct, first-person allergy declarations from a chat message. */
export function extractDeclaredAllergies(message: string): string[] {
	const content = sanitizeMessageContent(message);
	const declarations: string[] = [];
	const patterns = [
		/(?:^|[.!?;]\s+|\n+)(?:also,?\s+)?i(?:\s+am|'m)\s+(?:severely\s+)?allergic\s+to\s+([^.!?;\n]+)/giu,
		/(?:^|[.!?;]\s+|\n+)(?:also,?\s+)?i\s+have\s+(?:an?\s+)?allerg(?:y|ies)\s+to\s+([^.!?;\n]+)/giu
	];

	for (const pattern of patterns) {
		for (const match of content.matchAll(pattern)) {
			const declaredList = match[1].replace(
				/(?:,?\s+)(?:and\s+i\b|but\b|so\b|because\b|can\s+you\b|could\s+you\b|would\s+you\b|please\b|make\s+me\b|help\s+me\b|what\b|how\b).*$/iu,
				''
			);
			for (const item of declaredList.split(/\s*(?:,|\band\b|&)\s*/iu)) {
				const displayName = cleanDeclaredItem(item);
				if (displayName && normalizeAllergenName(displayName)) declarations.push(displayName);
			}
		}
	}

	const unique = new Map<string, string>();
	for (const declaration of declarations) {
		unique.set(normalizeAllergenName(declaration), declaration);
	}
	return [...unique.values()].slice(0, MAX_USER_ALLERGIES);
}

async function loadCatalog(database: Database): Promise<CatalogAllergen[]> {
	return database
		.select({
			slug: allergenCatalog.slug,
			name: allergenCatalog.name,
			aliases: allergenCatalog.aliases
		})
		.from(allergenCatalog)
		.orderBy(asc(allergenCatalog.name));
}

function normalizeAgainstCatalog(
	values: string[],
	catalog: CatalogAllergen[]
): NormalizedAllergy[] {
	const catalogByTerm = new Map<string, CatalogAllergen>();
	for (const entry of catalog) {
		for (const term of [entry.name, ...entry.aliases]) {
			catalogByTerm.set(normalizeAllergenName(term), entry);
		}
	}

	const normalized = new Map<string, NormalizedAllergy>();
	for (const value of values) {
		const displayName = cleanDeclaredItem(value);
		const inputName = normalizeAllergenName(displayName);
		if (!inputName) continue;
		const catalogEntry = catalogByTerm.get(inputName);
		const normalizedName = catalogEntry
			? normalizeAllergenName(catalogEntry.name)
			: inputName;
		normalized.set(normalizedName, {
			normalizedName,
			displayName: catalogEntry?.name ?? displayName,
			catalogSlug: catalogEntry?.slug ?? null
		});
	}
	return [...normalized.values()].slice(0, MAX_USER_ALLERGIES);
}

async function upsertUserAllergyRows(
	database: Database,
	userId: string,
	values: string[],
	source: UserAllergySource
): Promise<string[]> {
	if (values.length === 0) return [];
	const catalog = await loadCatalog(database);
	const normalized = normalizeAgainstCatalog(values, catalog);
	if (normalized.length === 0) return [];

	const existing = await database
		.select({ normalizedName: userAllergies.normalizedName })
		.from(userAllergies)
		.where(eq(userAllergies.userId, userId));
	const existingNames = new Set(existing.map(({ normalizedName }) => normalizedName));
	const available = Math.max(0, MAX_USER_ALLERGIES - existingNames.size);
	const accepted = normalized.filter(({ normalizedName }) => existingNames.has(normalizedName)).concat(
		normalized.filter(({ normalizedName }) => !existingNames.has(normalizedName)).slice(0, available)
	);
	if (accepted.length === 0) return [];

	const now = new Date();
	await database
		.insert(userAllergies)
		.values(
			accepted.map((allergy) => ({
				userId,
				...allergy,
				source,
				createdAt: now,
				updatedAt: now
			}))
		)
		.onConflictDoUpdate({
			target: [userAllergies.userId, userAllergies.normalizedName],
			set: { source, updatedAt: now }
		});

	return accepted.map(({ displayName }) => displayName);
}

export async function persistDeclaredAllergies(
	database: Database,
	userId: string,
	message: string
): Promise<string[]> {
	return upsertUserAllergyRows(database, userId, extractDeclaredAllergies(message), 'chat');
}

export async function replaceUserAllergies(
	database: Database,
	userId: string,
	values: string[]
): Promise<void> {
	await database.delete(userAllergies).where(eq(userAllergies.userId, userId));
	await upsertUserAllergyRows(database, userId, values, 'settings');
}

export async function loadUserAllergies(database: Database, userId: string): Promise<string[]> {
	const records = await database
		.select({ displayName: userAllergies.displayName })
		.from(userAllergies)
		.where(eq(userAllergies.userId, userId))
		.orderBy(asc(userAllergies.displayName));
	return records.map(({ displayName }) => displayName);
}

export async function loadAllergenWarningTerms(
	database: Database,
	userId: string
): Promise<string[]> {
	const [catalog, saved] = await Promise.all([
		loadCatalog(database),
		database
			.select({
				displayName: userAllergies.displayName,
				normalizedName: userAllergies.normalizedName
			})
			.from(userAllergies)
			.where(eq(userAllergies.userId, userId))
	]);
	const terms = new Map<string, string>();
	for (const term of catalog.flatMap((entry) => [entry.name, ...entry.aliases])) {
		terms.set(normalizeAllergenName(term), term);
	}
	for (const allergy of saved) {
		terms.set(allergy.normalizedName, allergy.displayName);
	}
	return [...terms.values()].sort((left, right) => right.length - left.length);
}
