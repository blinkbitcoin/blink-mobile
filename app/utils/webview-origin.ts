/**
 * Origin helpers for the in-app WebView (see webview.tsx).
 *
 * All helpers fail closed: an unparseable or non-http(s) URL never matches
 * anything. Same pattern as isMigrationDeeplink in navigation-container-wrapper.
 */

/**
 * Returns the exact origin (scheme://host[:port]) of a URL, or null when the
 * URL is unparseable or not http(s). `URL.origin` normalizes case and elides
 * default ports, so matching is structural — never a substring comparison.
 */
export const originOf = (url: string | undefined | null): string | null => {
  if (!url) return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null
    return parsed.origin
  } catch {
    return null
  }
}

/** Exact-origin membership test. Unparseable url or empty allowlist => false. */
export const isAllowedOrigin = (
  url: string | undefined | null,
  allowedOrigins: readonly string[],
): boolean => {
  const origin = originOf(url)
  if (origin === null) return false
  return allowedOrigins.includes(origin)
}

/**
 * Origins of the given URLs, deduplicated. Unparseable entries are dropped —
 * a misconfigured (e.g. Custom-instance) URL must shrink the allowlist, not
 * open it.
 */
export const originsFromUrls = (
  urls: readonly (string | undefined | null)[],
): string[] => {
  const origins = urls.map(originOf).filter((origin): origin is string => origin !== null)
  return [...new Set(origins)]
}
