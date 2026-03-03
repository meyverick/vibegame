import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	// 1. Performance: Caching for immutable assets (fingerprinted by Vite)
	if (
		event.url.pathname.startsWith('/_app/immutable/') ||
		event.url.pathname.match(/\.(woff2?|png|jpg|jpeg|gif|svg|webp|avif)$/)
	) {
		response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
	} else if (event.url.pathname.startsWith('/api/')) {
		// API responses should not be cached by default unless explicitly set in the handler
		if (!response.headers.has('Cache-Control')) {
			response.headers.set(
				'Cache-Control',
				'no-store, no-cache, must-revalidate, proxy-revalidate'
			);
		}
	}

	// 2. Security Headers
	// Note: Strict-Transport-Security is often better handled by the provider (e.g. Vercel),
	// but we include it here for robustness if deployed elsewhere.
	const securityHeaders = {
		'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
		'X-Content-Type-Options': 'nosniff',
		'X-Frame-Options': 'DENY',
		'Referrer-Policy': 'strict-origin-when-cross-origin',
		'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
		'Cross-Origin-Opener-Policy': 'same-origin',
		'Cross-Origin-Embedder-Policy': 'require-corp',
		'Cross-Origin-Resource-Policy': 'same-origin'
	};

	Object.entries(securityHeaders).forEach(([header, value]) => {
		response.headers.set(header, value);
	});

	return response;
};
