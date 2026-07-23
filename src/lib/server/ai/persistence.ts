import type { ModelMessage, LanguageModelUsage } from 'ai';
import type { Database } from '$lib/server/db';
import { aiGenerationAttempts, conversations, messages } from '$lib/server/db/schema';
import { hasStorageCapacity } from '$lib/server/security/limits';
import { buildRecentModelContext } from './request';
import { and, desc, eq, sql } from 'drizzle-orm';

const anticipatedAssistantBytes = 20_000;

export class ConversationAccessError extends Error {}
export class ConversationStorageError extends Error {}

export function conversationTitle(content: string): string {
	const compact = content.replace(/\s+/g, ' ').trim();
	return compact.length > 80 ? `${compact.slice(0, 77)}…` : compact;
}

export async function persistUserMessageForGeneration(
	database: Database,
	input: {
		userId: string;
		conversationId: string;
		messageId: string;
		content: string;
		now: Date;
	}
): Promise<void> {
	await database.execute(sql`select pg_advisory_xact_lock(hashtext(${input.userId}))`);
	const [existingConversation] = await database
		.select({ userId: conversations.userId })
		.from(conversations)
		.where(eq(conversations.id, input.conversationId))
		.limit(1);
	if (existingConversation && existingConversation.userId !== input.userId) {
		throw new ConversationAccessError('Conversation not found.');
	}
	const messageBytes = new TextEncoder().encode(input.content).byteLength;
	if (
		!(await hasStorageCapacity(database, input.userId, {
			conversations: existingConversation ? 0 : 1,
			messages: 2,
			messageBytes: messageBytes + anticipatedAssistantBytes
		}))
	) {
		throw new ConversationStorageError('Your account has reached its conversation storage limit.');
	}

	await database.execute(sql`select pg_advisory_xact_lock(hashtext(${input.conversationId}))`);
	let position = 0;
	if (existingConversation) {
		const [latestMessage] = await database
			.select({ position: messages.position })
			.from(messages)
			.where(eq(messages.conversationId, input.conversationId))
			.orderBy(desc(messages.position))
			.limit(1);
		position = (latestMessage?.position ?? -1) + 1;
		await database
			.update(conversations)
			.set({ updatedAt: input.now })
			.where(
				and(eq(conversations.id, input.conversationId), eq(conversations.userId, input.userId))
			);
	} else {
		await database.insert(conversations).values({
			id: input.conversationId,
			userId: input.userId,
			title: conversationTitle(input.content),
			createdAt: input.now,
			updatedAt: input.now,
			archivedAt: null
		});
	}

	await database.insert(messages).values({
		id: input.messageId,
		conversationId: input.conversationId,
		role: 'user',
		content: input.content,
		position,
		createdAt: input.now
	});
}

export async function getRecentConversationContext(
	database: Database,
	userId: string,
	conversationId: string
): Promise<ModelMessage[]> {
	const [ownedConversation] = await database
		.select({ id: conversations.id })
		.from(conversations)
		.where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
		.limit(1);
	if (!ownedConversation) throw new ConversationAccessError('Conversation not found.');

	const records = await database
		.select({ role: messages.role, content: messages.content })
		.from(messages)
		.where(eq(messages.conversationId, conversationId))
		.orderBy(desc(messages.position))
		.limit(20);
	return buildRecentModelContext(records.toReversed());
}

export async function persistCompletedAssistant(
	database: Database,
	input: {
		attemptId: string;
		userId: string;
		conversationId: string;
		assistantMessageId: string;
		content: string;
		usage: LanguageModelUsage;
		now?: Date;
	}
): Promise<void> {
	const now = input.now ?? new Date();
	const content = input.content.trim();
	if (!content) throw new Error('The provider returned an empty response.');

	await database.transaction(async (transaction) => {
		const tx = transaction as unknown as Database;
		await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.userId}))`);
		const [ownedConversation] = await tx
			.select({ id: conversations.id })
			.from(conversations)
			.where(and(eq(conversations.id, input.conversationId), eq(conversations.userId, input.userId)))
			.limit(1);
		if (!ownedConversation) throw new ConversationAccessError('Conversation not found.');
		if (
			!(await hasStorageCapacity(tx, input.userId, {
				conversations: 0,
				messages: 1,
				messageBytes: new TextEncoder().encode(content).byteLength
			}))
		) {
			throw new ConversationStorageError('Your account has reached its conversation storage limit.');
		}

		await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.conversationId}))`);
		const [latestMessage] = await tx
			.select({ position: messages.position })
			.from(messages)
			.where(eq(messages.conversationId, input.conversationId))
			.orderBy(desc(messages.position))
			.limit(1);
		await tx.insert(messages).values({
			id: input.assistantMessageId,
			conversationId: input.conversationId,
			role: 'assistant',
			content,
			position: (latestMessage?.position ?? -1) + 1,
			createdAt: now
		});
		await tx
			.update(conversations)
			.set({ updatedAt: now })
			.where(and(eq(conversations.id, input.conversationId), eq(conversations.userId, input.userId)));
		await tx
			.update(aiGenerationAttempts)
			.set({
				assistantMessageId: input.assistantMessageId,
				status: 'completed',
				inputTokens: input.usage.inputTokens,
				outputTokens: input.usage.outputTokens,
				totalTokens: input.usage.totalTokens,
				errorCode: null,
				completedAt: now
			})
			.where(eq(aiGenerationAttempts.id, input.attemptId));
	});
}
