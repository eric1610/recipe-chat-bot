export type OperationalLogLevel = 'info' | 'warn' | 'error';
export type OperationalSubsystem = 'application' | 'database' | 'ai_provider' | 'cron' | 'health';

export interface OperationalEvent {
	level: OperationalLogLevel;
	event: string;
	subsystem: OperationalSubsystem;
	requestId?: string;
	route?: string;
	method?: string;
	status?: number;
	code?: string;
	durationMs?: number;
}

interface LogOptions {
	now?: Date;
	sink?: (level: OperationalLogLevel, line: string) => void;
}

const safeToken = /^[A-Za-z0-9_./:[\]-]{1,128}$/;

function token(value: string | undefined): string | undefined {
	return value && safeToken.test(value) ? value : undefined;
}

function defaultSink(level: OperationalLogLevel, line: string) {
	if (level === 'error') console.error(line);
	else if (level === 'warn') console.warn(line);
	else console.info(line);
}

export function logOperationalEvent(event: OperationalEvent, options: LogOptions = {}): void {
	const line = JSON.stringify({
		timestamp: (options.now ?? new Date()).toISOString(),
		level: event.level,
		event: token(event.event) ?? 'invalid_event',
		subsystem: event.subsystem,
		...(token(event.requestId) ? { requestId: token(event.requestId) } : {}),
		...(token(event.route) ? { route: token(event.route) } : {}),
		...(token(event.method) ? { method: token(event.method) } : {}),
		...(Number.isInteger(event.status) ? { status: event.status } : {}),
		...(token(event.code) ? { code: token(event.code) } : {}),
		...(Number.isFinite(event.durationMs) && event.durationMs! >= 0
			? { durationMs: Math.round(event.durationMs!) }
			: {})
	});
	(options.sink ?? defaultSink)(event.level, line);
}

export function safeErrorName(error: unknown): string {
	return error instanceof Error && token(error.name) ? error.name : 'UnknownError';
}
