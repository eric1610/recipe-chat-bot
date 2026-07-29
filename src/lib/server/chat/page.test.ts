import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ deleteConversation: vi.fn(), where: vi.fn() }));
const database = {
	delete: mocks.deleteConversation
};

vi.mock('$lib/server/db', () => ({ getDatabase: () => database }));

import { deleteChatConversation } from './page';

const conversationId = '018f47a2-2d8e-7a15-8f7e-0123456789ab';
const url = new URL('https://recipe.example/chat');

function request(id: string, origin = url.origin): Request {
	return new Request(url, {
		method: 'POST',
		headers: {
			origin,
			'content-type': 'application/x-www-form-urlencoded'
		},
		body: new URLSearchParams({ conversationId: id })
	});
}

const locals = {
	auth: vi.fn().mockResolvedValue({ user: { id: 'user-1' } })
} as unknown as App.Locals;

describe('conversation deletion validation', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.where.mockResolvedValue(undefined);
		mocks.deleteConversation.mockReturnValue({ where: mocks.where });
	});

	it('rejects invalid UUID input before querying Postgres', async () => {
		const result = await deleteChatConversation(
			request('<script>alert(1)</script>'),
			locals,
			url
		);

		expect(result).toMatchObject({
			status: 400,
			data: { deleteError: 'A valid conversation ID is required.' }
		});
		expect(mocks.deleteConversation).not.toHaveBeenCalled();
	});

	it('rejects cross-origin form submissions before querying Postgres', async () => {
		await expect(
			deleteChatConversation(request(conversationId, 'https://attacker.example'), locals, url)
		).rejects.toMatchObject({ status: 403 });
		expect(mocks.deleteConversation).not.toHaveBeenCalled();
	});

	it('accepts a valid same-origin UUID and performs an account-scoped delete', async () => {
		await expect(deleteChatConversation(request(conversationId), locals, url)).resolves.toEqual({
			deleted: true
		});
		expect(mocks.deleteConversation).toHaveBeenCalledOnce();
		expect(mocks.where).toHaveBeenCalledOnce();
	});
});
