/**
 * Doc versions: URL uses main version only (0, 1). Dropdown shows full version (0.0.1, 1.12.1).
 * First entry is default (shown when URL is /docs with no version).
 */
export const DOC_VERSION_URL_SEGMENTS = ['0'] as const;
export type DocVersionUrl = (typeof DOC_VERSION_URL_SEGMENTS)[number];

/** Full version label for display (e.g. 0.0.1, 1.12.1). */
export const DOC_VERSION_LABELS: Record<DocVersionUrl, string> = {
  '0': '0.0.2',
};

export const DEFAULT_DOC_VERSION: DocVersionUrl = DOC_VERSION_URL_SEGMENTS[0];

/** Returns true if the segment is a known URL version (main version only). */
export function isVersionSegment(segment: string): segment is DocVersionUrl {
  return (DOC_VERSION_URL_SEGMENTS as readonly string[]).includes(segment);
}

/**
 * Parse pathname (e.g. /docs/1/intro) into version (URL segment) and doc path.
 * - /docs → version = first, docPath = []
 * - /docs/1 → version = '1', docPath = []
 * - /docs/1/intro → version = '1', docPath = ['intro']
 * - /docs/intro → version = first, docPath = ['intro']
 */
export function parseDocsPathname(pathname: string): {
  version: DocVersionUrl;
  docSegments: string[];
} {
  if (!pathname.startsWith('/docs')) {
    return { version: DEFAULT_DOC_VERSION, docSegments: [] };
  }
  const after = pathname.slice(5).replace(/^\//, '') || '';
  const segments = after ? after.split('/') : [];
  if (segments.length > 0 && isVersionSegment(segments[0])) {
    return {
      version: segments[0] as DocVersionUrl,
      docSegments: segments.slice(1),
    };
  }
  return {
    version: DEFAULT_DOC_VERSION,
    docSegments: segments,
  };
}

/**
 * Build docs URL for a version (main only: 0, 1) and optional doc path.
 * For default version we use /docs or /docs/path (no version in URL).
 */
export function buildDocsUrl(version: DocVersionUrl, docSegments: string[]): string {
  const path = docSegments.length ? `/${docSegments.join('/')}` : '';
  if (version === DEFAULT_DOC_VERSION) {
    return `/docs${path}`;
  }
  return `/docs/${version}${path}`;
}

/**
 * Build docs URL for a sidebar item.url (e.g. /docs or /docs/introduction).
 */
export function buildDocsHref(itemUrl: string, version: DocVersionUrl): string {
  if (version === DEFAULT_DOC_VERSION) return itemUrl;
  const suffix = itemUrl === '/docs' ? '' : itemUrl.slice(5);
  return `/docs/${version}${suffix}`;
}
