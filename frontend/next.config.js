const defaultCache = require('next-pwa/cache');

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  customWorkerDir: 'worker',
  runtimeCaching: [
    // Replace the default 'apis' entry to exclude SSE — it must reach the
    // browser natively; passing a streaming response through the SW breaks
    // EventSource on mobile.
    {
      urlPattern: ({ url, sameOrigin }) => {
        if (!sameOrigin) return false;
        const p = url.pathname;
        return !p.startsWith('/api/auth/') && !p.startsWith('/api/sse/') && p.startsWith('/api/');
      },
      handler: 'NetworkFirst',
      options: {
        cacheName: 'apis',
        networkTimeoutSeconds: 10,
        expiration: { maxEntries: 16, maxAgeSeconds: 86400 },
      },
    },
    ...defaultCache.filter((_, i) => i !== 11), // remove default apis entry
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@excalidraw/excalidraw',
    'react-markdown',
    'remark-gfm',
    'remark-parse',
    'unified',
    'bail',
    'is-plain-obj',
    'trough',
    'vfile',
    'vfile-message',
    'unist-util-stringify-position',
    'mdast-util-from-markdown',
    'mdast-util-to-string',
    'mdast-util-to-hast',
    'mdast-util-gfm',
    'mdast-util-gfm-autolink-literal',
    'mdast-util-gfm-footnote',
    'mdast-util-gfm-strikethrough',
    'mdast-util-gfm-table',
    'mdast-util-gfm-task-list-item',
    'micromark',
    'micromark-core-commonmark',
    'micromark-extension-gfm',
    'micromark-extension-gfm-autolink-literal',
    'micromark-extension-gfm-footnote',
    'micromark-extension-gfm-strikethrough',
    'micromark-extension-gfm-table',
    'micromark-extension-gfm-tagfilter',
    'micromark-extension-gfm-task-list-item',
    'micromark-factory-destination',
    'micromark-factory-label',
    'micromark-factory-space',
    'micromark-factory-title',
    'micromark-factory-whitespace',
    'micromark-util-character',
    'micromark-util-chunked',
    'micromark-util-classify-character',
    'micromark-util-combine-extensions',
    'micromark-util-decode-numeric-character-reference',
    'micromark-util-decode-string',
    'micromark-util-encode',
    'micromark-util-html-tag-name',
    'micromark-util-normalize-identifier',
    'micromark-util-resolve-all',
    'micromark-util-sanitize-uri',
    'micromark-util-subtokenize',
    'micromark-util-symbol',
    'micromark-util-types',
    'ccount',
    'comma-separated-tokens',
    'decode-named-character-reference',
    'devlop',
    'escape-string-regexp',
    'hast-util-to-jsx-runtime',
    'hast-util-whitespace',
    'html-url-attributes',
    'property-information',
    'space-separated-tokens',
    'stringify-entities',
    'trim-lines',
    'unist-util-is',
    'unist-util-position',
    'unist-util-visit',
    'unist-util-visit-parents',
    'zwitch',
  ],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*',
      },
    ];
  },
};

module.exports = withPWA(nextConfig);
