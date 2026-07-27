import type { ModelMessage } from 'ai';
import { sanitizeMessageContent } from '$lib/chat/content';
import { z } from 'zod';

const messageContentSchema = z
	.string()
	.max(8_000)
	.transform(sanitizeMessageContent)
	.pipe(z.string().min(1).max(8_000));

const chatRequestSchema = z
	.object({
		conversationId: z.string().uuid(),
		message: z
			.object({
				id: z.string().uuid(),
				content: messageContentSchema
			})
			.strict()
	})
	.strict();

export interface ChatGenerationRequest {
	conversationId: string;
	message: {
		id: string;
		content: string;
	};
}

export interface ContextMessage {
	role: 'user' | 'assistant' | 'system';
	content: string;
}

export function parseChatGenerationRequest(value: unknown): ChatGenerationRequest {
	const parsed = chatRequestSchema.safeParse(value);
	if (!parsed.success) throw new Error('Send one valid message of at most 8,000 characters.');
	return parsed.data;
}

export function buildRecentModelContext(
	messages: ContextMessage[],
	maxMessages = 10,
	maxCharacters = 12_000
): ModelMessage[] {
	const selected: ModelMessage[] = [];
	let characters = 0;
	for (const message of messages.toReversed()) {
		const content = sanitizeMessageContent(message.content);
		if (message.role === 'system' || !content) continue;
		if (selected.length >= maxMessages) break;
		if (characters + content.length > maxCharacters && selected.length > 0) break;
		selected.push({ role: message.role, content });
		characters += content.length;
	}
	return selected.reverse();
}
