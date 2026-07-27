import { describe, expect, it } from 'vitest';
import {
	AI_ATTEMPT_RETENTION_DAYS,
	getAiCleanupCutoffs
} from './cleanup';

describe('AI quota cleanup policy', () => {
	it('derives every cutoff from one reference timestamp', () => {
		const now = new Date('2030-05-10T17:30:00.000Z');
		expect(getAiCleanupCutoffs(now)).toEqual({
			now,
			attemptExpiry: new Date('2030-05-10T17:28:00.000Z'),
			attemptRetention: new Date('2030-05-03T17:30:00.000Z'),
			quotaWindowRetention: new Date('2030-05-09T00:00:00.000Z')
		});
		expect(AI_ATTEMPT_RETENTION_DAYS).toBe(7);
	});

	it('uses UTC calendar boundaries across local timezone and daylight-saving changes', () => {
		expect(getAiCleanupCutoffs(new Date('2030-03-10T00:00:00.000Z')).quotaWindowRetention)
			.toEqual(new Date('2030-03-09T00:00:00.000Z'));
		expect(getAiCleanupCutoffs(new Date('2030-03-09T23:59:59.999Z')).quotaWindowRetention)
			.toEqual(new Date('2030-03-08T00:00:00.000Z'));
	});
});
