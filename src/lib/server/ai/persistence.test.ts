import { describe, expect, it } from 'vitest';
import {
	ConversationAccessError,
	getAttemptCompletionAction
} from './persistence';
import type { AiGenerationAttemptStatus } from '$lib/server/db/schema';

const now = new Date('2030-05-02T17:30:00.000Z');
const baseAttempt = {
	userId: 'user-1',
	conversationId: '7d48e68c-6f06-46b7-92bb-1f63325c4324',
	assistantMessageId: null,
	status: 'started' as AiGenerationAttemptStatus,
	createdAt: new Date(now.getTime() - 60_000)
};
const input = {
	userId: baseAttempt.userId,
	conversationId: baseAttempt.conversationId,
	assistantMessageId: 'fd3db83a-a52d-49c8-8f98-cecde233c171',
	now
};

describe('AI completion persistence policy', () => {
	it('allows active attempts to persist within the provider timeout grace period', () => {
		expect(getAttemptCompletionAction(baseAttempt, input)).toBe('persist');
		expect(
			getAttemptCompletionAction({ ...baseAttempt, status: 'reserved' }, input)
		).toBe('persist');
	});

	it('treats a repeated completion with the same assistant message as idempotent', () => {
		expect(
			getAttemptCompletionAction(
				{
					...baseAttempt,
					status: 'completed',
					assistantMessageId: input.assistantMessageId
				},
				input
			)
		).toBe('already_completed');
	});

	it('rejects a repeated completion that names a different assistant message', () => {
		expect(() =>
			getAttemptCompletionAction(
				{
					...baseAttempt,
					status: 'completed',
					assistantMessageId: '8627b623-a2b1-4a10-8b33-3795fc9d992e'
				},
				input
			)
		).toThrow('already completed with another response');
	});

	it.each(['failed', 'cancelled', 'provider_limited'] as const)(
		'rejects a terminal %s attempt',
		(status) => {
			expect(() => getAttemptCompletionAction({ ...baseAttempt, status }, input)).toThrow(
				'no longer active'
			);
		}
	);

	it('rejects an attempt that has exceeded the two-minute completion window', () => {
		expect(() =>
			getAttemptCompletionAction(
				{ ...baseAttempt, createdAt: new Date(now.getTime() - 120_001) },
				input
			)
		).toThrow('expired');
	});

	it('does not allow an attempt to cross user or conversation ownership boundaries', () => {
		expect(() =>
			getAttemptCompletionAction(baseAttempt, { ...input, userId: 'user-2' })
		).toThrow(ConversationAccessError);
		expect(() =>
			getAttemptCompletionAction(baseAttempt, {
				...input,
				conversationId: '3cdf0be3-e0b9-47f1-a838-c968cd032099'
			})
		).toThrow(ConversationAccessError);
	});
});
