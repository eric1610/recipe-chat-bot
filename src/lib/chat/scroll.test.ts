import { describe, expect, it } from 'vitest';
import {
	CHAT_FOLLOW_THRESHOLD_PX,
	distanceFromBottom,
	shouldFollowLatest
} from './scroll';

describe('chat scroll following', () => {
	it('measures the remaining distance without returning negative values', () => {
		expect(distanceFromBottom({ scrollTop: 700, scrollHeight: 1_000, clientHeight: 300 })).toBe(0);
		expect(distanceFromBottom({ scrollTop: 750, scrollHeight: 1_000, clientHeight: 300 })).toBe(0);
		expect(distanceFromBottom({ scrollTop: 600, scrollHeight: 1_000, clientHeight: 300 })).toBe(100);
	});

	it('follows while the reader is at or near the bottom', () => {
		expect(
			shouldFollowLatest({
				scrollTop: 1_000 - 400 - CHAT_FOLLOW_THRESHOLD_PX,
				scrollHeight: 1_000,
				clientHeight: 400
			})
		).toBe(true);
	});

	it('pauses once the reader moves beyond the follow threshold', () => {
		expect(
			shouldFollowLatest({
				scrollTop: 1_000 - 400 - CHAT_FOLLOW_THRESHOLD_PX - 1,
				scrollHeight: 1_000,
				clientHeight: 400
			})
		).toBe(false);
	});

	it('supports an explicit threshold', () => {
		expect(
			shouldFollowLatest({ scrollTop: 550, scrollHeight: 1_000, clientHeight: 400 }, 50)
		).toBe(true);
		expect(
			shouldFollowLatest({ scrollTop: 549, scrollHeight: 1_000, clientHeight: 400 }, 50)
		).toBe(false);
	});
});
