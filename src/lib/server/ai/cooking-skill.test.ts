import { describe, expect, it } from 'vitest';
import { buildCookingSkillInstructions, resolveCookingSkill } from './cooking-skill';

describe('cooking skill guidance policy', () => {
	it.each([
		['beginner', ['everyday language', 'define cooking techniques', 'sensory doneness cues', 'recovery tip']],
		['intermediate', ['standard cooking terminology', 'less-common techniques', 'important visual or sensory cues']],
		['advanced', ['concise technical language', 'precise timing, temperature, sequencing', 'specialist equipment']],
		['standard', ['neutral intermediate-depth guidance', 'brief explanations', 'unexplained advanced assumptions']]
	] as const)('defines distinct %s behavior', (skill, requirements) => {
		const instructions = buildCookingSkillInstructions(skill === 'standard' ? null : skill);

		for (const requirement of requirements) expect(instructions).toContain(requirement);
	});

	it('uses Standard for missing or malformed values', () => {
		expect(resolveCookingSkill(null)).toBe('standard');
		expect(resolveCookingSkill('expert')).toBe('standard');
		expect(buildCookingSkillInstructions('expert')).toContain('Saved guidance level: Standard');
	});

	it('allows only a per-response explicit override and preserves safety precedence', () => {
		const instructions = buildCookingSkillInstructions('advanced');

		expect(instructions).toContain('latest user message explicitly asks');
		expect(instructions).toContain('this response only');
		expect(instructions).toContain('does not change the saved account preference');
		expect(instructions).toContain('food-safety requirements');
		expect(instructions).toContain('Never omit a necessary safety or doneness instruction');
	});

	it('defines every level so a one-response override has concrete behavior', () => {
		const instructions = buildCookingSkillInstructions('beginner');

		expect(instructions).toContain('- Beginner:');
		expect(instructions).toContain('- Intermediate:');
		expect(instructions).toContain('- Advanced:');
		expect(instructions).toContain('- Standard:');
		expect(instructions).toContain('concise technical language');
	});

	it('documents representative guidance-level acceptance examples', () => {
		const examples = {
			beginner: 'Sauté (cook quickly in a little oil) until the onion looks translucent and smells sweet.',
			intermediate: 'Sauté the onion until translucent, 4–5 minutes.',
			advanced: 'Sweat the onion without colour, deglaze, and reduce to au sec.'
		};

		expect(examples.beginner).toContain('cook quickly in a little oil');
		expect(examples.beginner).toContain('looks translucent');
		expect(examples.intermediate).toContain('Sauté');
		expect(examples.intermediate).toMatch(/\d–\d minutes/);
		expect(examples.advanced).toContain('deglaze');
		expect(examples.advanced).not.toContain('cook quickly in a little oil');
	});
});
