export const CHAT_FOLLOW_THRESHOLD_PX = 96;

export interface ScrollMetrics {
	scrollTop: number;
	scrollHeight: number;
	clientHeight: number;
}

export function distanceFromBottom(metrics: ScrollMetrics): number {
	return Math.max(0, metrics.scrollHeight - metrics.clientHeight - metrics.scrollTop);
}

export function shouldFollowLatest(
	metrics: ScrollMetrics,
	threshold = CHAT_FOLLOW_THRESHOLD_PX
): boolean {
	return distanceFromBottom(metrics) <= threshold;
}
