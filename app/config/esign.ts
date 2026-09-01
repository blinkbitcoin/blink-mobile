/**
 * The published DocuSign Web Form the investment subscription agreement is signed
 * on. Public-URL mode: the form is published once in the Web Forms builder and the
 * same link is embedded for every signer, so no backend and no credentials are
 * involved. Prefilled values would ride in the query string, so nothing personal
 * goes here.
 *
 * Empty until the form is published, which leaves the signing screen with nothing
 * to embed: it has to be filled in before the investment flow ships.
 */
export const ESIGN_INVESTMENT_FORM_URL = ""

/**
 * The origin the embedded page is expected to post signing events from, carried on
 * the signing session; a form served from a different DocuSign environment needs
 * this changed alongside the URL above.
 *
 * Advisory only for now: the ESignature component stores it on the session but does
 * not yet filter postMessage by origin, and it renders the WebView without an
 * originWhitelist, so any page the form navigates to can still emit a signing
 * event. Enforcement has to land in @blinkbitcoin/esign-react-native.
 */
export const ESIGN_ALLOWED_ORIGIN = "https://apps.docusign.com"
