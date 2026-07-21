import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';

function normalizeBasePath(value: string | undefined): '' | `/${string}` {
	if (!value) return '';
	return value.startsWith('/') ? (value as `/${string}`) : `/${value}`;
}

export default defineConfig(({ command, mode }) => {
	const env = loadEnv(mode, '.', 'BASE_');

	return {
		plugins: [
			tailwindcss(),
			sveltekit({
				compilerOptions: {
					// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
					runes: ({ filename }) =>
						filename.split(/[/\\]/).includes('node_modules') ? undefined : true
				},

				adapter: adapter({
					fallback: '404.html'
				}),
				paths: {
					base: command === 'serve' ? '' : normalizeBasePath(env.BASE_PATH)
				}
			})
		]
	};
});
