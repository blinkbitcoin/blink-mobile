/**
 * The only origin the embedded signing page is expected to post its events from,
 * carried on the signing session. A form published in DocuSign's demo environment is
 * served from a different host and needs this changed to match.
 *
 * The ESignature component stores it on the session rather than enforcing it: it
 * filters nothing by origin and renders the WebView without an originWhitelist, so
 * this narrows intent, not access.
 *
 * The form URL itself is remote config (cardInvestmentEsignFormUrl), so the form can
 * change without shipping a release.
 */
export const ESIGN_ALLOWED_ORIGIN = "https://apps.docusign.com"
