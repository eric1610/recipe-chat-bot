import { describe, expect, it } from 'vitest';
import { shouldSubmitComposer } from './composer';

describe('chat composer keyboard behavior', () => {
	it('submits on Enter', () => {
		expect(shouldSubmitComposer({ key: 'Enter', shiftKey: false })).toBe(true);
	});

	it('keeps Shift+Enter available for a new line', () => {
		expect(shouldSubmitComposer({ key: 'Enter', shiftKey: true })).toBe(false);
	});

	it('does not submit repeated or composing Enter events', () => {
		expect(shouldSubmitComposer({ key: 'Enter', shiftKey: false, repeat: true })).toBe(false);
		expect(shouldSubmitComposer({ key: 'Enter', shiftKey: false, isComposing: true })).toBe(false);
	});

	it('ignores other keys', () => {
		expect(shouldSubmitComposer({ key: 'Space', shiftKey: false })).toBe(false);
	});
});
