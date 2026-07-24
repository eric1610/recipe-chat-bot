import { describe, expect, it } from 'vitest';
import {
	createUsageSnapshot,
	getQuotaDenial,
	getUtcQuotaWindow,
	isQuotaExempt,
	parseRetryAfter
} from './quota';

const now = new Date('2030-05-02T17:30:00.000Z');
const windowEnd = new Date('2030-05-03T00:00:00.000Z');

function usage(personalCount: number, sharedCount: number, isExempt = false, blockedUntil: Date | null = null) {
	return createUsageSnapshot({
		personalCount,
		personalInFlightCount: 0,
		sharedCount,
		isExempt,
		providerBlockedUntil: blockedUntil,
		now,
		windowEnd
	});
}

describe('AI quota policy', () => {
	it('uses a deterministic UTC calendar day', () => {
		expect(getUtcQuotaWindow(now)).toEqual({
			start: new Date('2030-05-02T00:00:00.000Z'),
			end: windowEnd
		});
	});

	it('normalizes the server-configured exemption allowlist', () => {
		expect(isQuotaExempt('Cook@Example.com', 'other@example.com, cook@example.com')).toBe(true);
		expect(isQuotaExempt('unknown@example.com', 'cook@example.com')).toBe(false);
		expect(isQuotaExempt(null, 'cook@example.com')).toBe(false);
	});

	it('warns standard users at eight requests and exhausts them at ten', () => {
		expect(usage(7, 7).user).toEqual({ used: 7, limit: 10, state: 'available' });
		expect(usage(8, 8).user.state).toBe('near');
		expect(usage(10, 10).user.state).toBe('exhausted');
	});

	it('keeps exempt users uncapped while preserving their usage count', () => {
		expect(usage(75, 20, true).user).toEqual({ used: 75, limit: null, state: 'available' });
	});

	it('exposes only qualitative shared states at the warning thresholds', () => {
		expect(usage(1, 39).shared.state).toBe('available');
		expect(usage(1, 40).shared.state).toBe('near');
		expect(usage(1, 45).shared.state).toBe('critical');
		expect(usage(1, 50).shared.state).toBe('exhausted');
	});

	it('treats a live provider block as exhausted even below the internal cap', () => {
		expect(usage(1, 3, false, new Date('2030-05-02T17:31:00.000Z')).shared.state).toBe('exhausted');
		expect(usage(1, 3, false, new Date('2030-05-02T17:29:00.000Z')).shared.state).toBe('available');
	});

	it('allows request 50 and denies request 51 at the shared boundary', () => {
		const values = {
			personalCount: 1,
			personalInFlightCount: 0,
			sharedCount: 49,
			isExempt: false,
			providerBlockedUntil: null,
			now,
			windowEnd
		};
		expect(getQuotaDenial(values)).toBeNull();
		expect(getQuotaDenial({ ...values, sharedCount: 50 })).toBe('shared_limit');
	});

	it('lets an exempt user bypass only the personal boundary', () => {
		const values = {
			personalCount: 10,
			personalInFlightCount: 0,
			sharedCount: 20,
			isExempt: false,
			providerBlockedUntil: null,
			now,
			windowEnd
		};
		expect(getQuotaDenial(values)).toBe('personal_limit');
		expect(getQuotaDenial({ ...values, isExempt: true })).toBeNull();
		expect(getQuotaDenial({ ...values, isExempt: true, sharedCount: 50 })).toBe('shared_limit');
	});

	it('reserves in-flight personal slots without adding them to completed usage', () => {
		const values = {
			personalCount: 9,
			personalInFlightCount: 1,
			sharedCount: 20,
			isExempt: false,
			providerBlockedUntil: null,
			now,
			windowEnd
		};
		expect(createUsageSnapshot(values).user).toEqual({ used: 9, limit: 10, state: 'near' });
		expect(getQuotaDenial(values)).toBe('personal_limit');
		expect(getQuotaDenial({ ...values, personalInFlightCount: 0 })).toBeNull();
	});

	it('does not apply in-flight personal slots to exempt users', () => {
		const values = {
			personalCount: 75,
			personalInFlightCount: 4,
			sharedCount: 20,
			isExempt: true,
			providerBlockedUntil: null,
			now,
			windowEnd
		};
		expect(getQuotaDenial(values)).toBeNull();
		expect(createUsageSnapshot(values).user.used).toBe(75);
	});

	it('parses numeric and HTTP-date Retry-After values without accepting stale dates', () => {
		expect(parseRetryAfter({ 'retry-after': '120' }, now)).toEqual(new Date('2030-05-02T17:32:00.000Z'));
		expect(parseRetryAfter({ 'retry-after': 'Thu, 02 May 2030 17:35:00 GMT' }, now)).toEqual(
			new Date('2030-05-02T17:35:00.000Z')
		);
		expect(parseRetryAfter({ 'retry-after': 'Thu, 02 May 2030 17:00:00 GMT' }, now)).toBeNull();
	});
});
