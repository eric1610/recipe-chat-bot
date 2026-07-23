export interface ComposerKeyEvent {
	key: string;
	shiftKey: boolean;
	isComposing?: boolean;
	repeat?: boolean;
}

export function shouldSubmitComposer(event: ComposerKeyEvent): boolean {
	return event.key === 'Enter' && !event.shiftKey && !event.isComposing && !event.repeat;
}
