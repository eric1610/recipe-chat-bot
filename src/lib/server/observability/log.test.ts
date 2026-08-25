import { describe, expect, it, vi } from 'vitest';
import { logOperationalEvent, safeErrorName } from './log';

describe('operational logging', () => {
	it('emits a structured allowlisted event', () => {
		const sink = vi.fn();
		logOperationalEvent(
			{
				level: 'error',
				event: 'server.unhandled_error',
				subsystem: 'application',
				requestId: 'request-123',
				route: '/api/chat',
				method: 'POST',
				status: 500,
				code: 'TypeError',
				durationMs: 12.6
			},
			{ now: new Date('2030-05-02T10:00:00.000Z'), sink }
		);

		expect(sink).toHaveBeenCalledWith(
			'error',
			JSON.stringify({
				timestamp: '2030-05-02T10:00:00.000Z',
				level: 'error',
				event: 'server.unhandled_error',
				subsystem: 'application',
				requestId: 'request-123',
				route: '/api/chat',
				method: 'POST',
				status: 500,
				code: 'TypeError',
				durationMs: 13
			})
		);
	});

	it('drops arbitrary strings instead of serializing sensitive details', () => {
		const sink = vi.fn();
		logOperationalEvent(
			{
				level: 'error',
				event: 'event with secret=abc',
				subsystem: 'database',
				requestId: 'request cookie=value',
				code: 'password=secret'
			},
			{ sink }
		);
		const line = sink.mock.calls[0][1] as string;
		expect(line).not.toContain('secret');
		expect(line).not.toContain('cookie');
		expect(JSON.parse(line)).toMatchObject({ event: 'invalid_event', subsystem: 'database' });
	});

	it('does not expose arbitrary error messages or names', () => {
		const error = new Error('postgresql://user:password@example.test/database');
		error.name = 'Error with database credentials';
		expect(safeErrorName(error)).toBe('UnknownError');
		expect(safeErrorName(new TypeError('private response body'))).toBe('TypeError');
	});
});
