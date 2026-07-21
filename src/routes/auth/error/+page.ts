import type { PageLoad } from './$types';

export const load: PageLoad = ({ url }) => ({
	error: url.searchParams.get('error') ?? 'Configuration'
});
