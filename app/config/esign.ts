/**
 * The only origin the embedded signing page is expected to post its events from,
 * carried on the signing session. A form published in DocuSign's demo environment is
 * served from a different host and needs this changed to match.
 *
 * The library stores it on the session rather than enforcing it: nothing is filtered by
 * origin, and the WebView the signing step renders carries no originWhitelist, so this
 * narrows intent, not access.
 *
 * The form URL itself is remote config (cardInvestmentEsignFormUrl), so the form can
 * change without shipping a release.
 */
export const ESIGN_ALLOWED_ORIGIN = "https://apps.docusign.com"
