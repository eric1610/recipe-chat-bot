export type AiAvailability = 'available' | 'near' | 'critical' | 'exhausted';
export type PersonalAiAvailability = 'available' | 'near' | 'exhausted';

export interface AiUsageSnapshot {
	user: {
		used: number;
		limit: number | null;
		state: PersonalAiAvailability;
	};
	shared: {
		state: AiAvailability;
		resetsAt: string;
	};
}
