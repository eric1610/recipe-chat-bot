import { describe, expect, it } from 'vitest';
import { assessAiProviderHealth } from './health';

const now = new Date('2030-05-02T10:00:00.000Z');

describe('AI provider health', () => {
	it('reports missing provider configuration as unavailable', () => {
		expect(
			assessAiProviderHealth(false, { providerBlockedUntil: null, latestAttempt: null }, now)
		).toEqual({ status: 'unavailable', code: 'not_configured' });
	});

	it('reports an active provider block as degraded', () => {
		expect(
			assessAiProviderHealth(
				true,
				{
					providerBlockedUntil: new Date('2030-05-02T10:10:00.000Z'),
					latestAttempt: { status: 'completed', errorCode: null }
				},
				now
			)
		).toEqual({ status: 'degraded', code: 'provider_limited' });
	});

	it('reports recent classified provider failures as degraded', () => {
		for (const errorCode of ['provider_unavailable', 'generation_failed']) {
			expect(
				assessAiProviderHealth(
					true,
					{
						providerBlockedUntil: null,
						latestAttempt: { status: 'failed', errorCode }
					},
					now
				)
			).toEqual({ status: 'degraded', code: 'recent_provider_failure' });
		}
	});

	it('reports a recent success and no recent activity as healthy', () => {
		expect(
			assessAiProviderHealth(
				true,
				{
					providerBlockedUntil: null,
					latestAttempt: { status: 'completed', errorCode: null }
				},
				now
			)
		).toEqual({ status: 'ok', code: 'recent_success' });
		expect(
			assessAiProviderHealth(true, { providerBlockedUntil: null, latestAttempt: null }, now)
		).toEqual({ status: 'ok', code: 'no_recent_activity' });
	});

	it('does not treat application-side attempt failures as provider outages', () => {
		expect(
			assessAiProviderHealth(
				true,
				{
					providerBlockedUntil: null,
					latestAttempt: { status: 'failed', errorCode: 'assistant_persistence_failed' }
				},
				now
			)
		).toEqual({ status: 'ok', code: 'ready' });
	});
});
