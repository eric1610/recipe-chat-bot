import { Parser } from 'htmlparser2';
import robotsParser from 'robots-parser';

const userAgent = 'RecipeChatBot/1.0 (+https://github.com/eric1610/recipe-chat-bot)';
const input = process.argv[2];
if (!input) {
	console.error('Usage: pnpm recipe:sources:audit -- https://recipes.example/path');
	process.exitCode = 1;
} else {
	const url = new URL(input);
	if (url.protocol !== 'https:') throw new Error('Only HTTPS recipe pages can be reviewed.');
	const robotsUrl = new URL('/robots.txt', url.origin);
	const robotsResponse = await fetch(robotsUrl, { headers: { 'user-agent': userAgent } });
	const robotsText = robotsResponse.ok ? await robotsResponse.text() : '';
	const robotsAllowed = robotsResponse.status === 404 || (robotsResponse.ok && robotsParser(robotsUrl.toString(), robotsText).isAllowed(url.toString(), userAgent) !== false);
	const pageResponse = await fetch(url, { headers: { 'user-agent': userAgent, accept: 'text/html' }, redirect: 'follow' });
	const html = pageResponse.ok ? await pageResponse.text() : '';
	let jsonLdBlocks = 0;
	let recipeNodes = 0;
	let current = null;
	const parser = new Parser({
		onopentag(name, attributes) {
			if (name === 'script' && attributes.type?.toLowerCase() === 'application/ld+json') current = [];
		},
		ontext(text) { if (current) current.push(text); },
		onclosetag(name) {
			if (name !== 'script' || !current) return;
			jsonLdBlocks += 1;
			try {
				const raw = JSON.stringify(JSON.parse(current.join('')));
				recipeNodes += (raw.match(/"@type":(?:"Recipe"|\[[^\]]*"Recipe")/g) ?? []).length;
			} catch {}
			current = null;
		}
	});
	parser.end(html);
	console.log(JSON.stringify({
		requestedUrl: url.toString(), finalUrl: pageResponse.url, status: pageResponse.status,
		contentType: pageResponse.headers.get('content-type'), robotsUrl: robotsUrl.toString(),
		robotsAllowed, jsonLdBlocks, recipeNodes,
		manualReviewRequired: ['source terms and reuse rights', 'attribution requirements', 'allowed path prefixes']
	}, null, 2));
	if (!pageResponse.ok || !robotsAllowed || recipeNodes === 0) process.exitCode = 2;
}
