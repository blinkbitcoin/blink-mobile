/**
 * How the flow writes its figures on screen, the same way on every step from the option
 * the investor taps to the transfer.
 */

/**
 * The locale every figure of the flow is written in: the one the rest of the app formats
 * money in. Left unnamed, `toLocaleString` goes through the number-format polyfill the
 * app installs in `i18n/mapping.ts`, whose default is whichever locale data loaded
 * first rather than the device's, and every phone printed $25 000 here while the rest
 * of the app printed $25,000.00.
 */
const FIGURE_LOCALE = "en-US"

/**
 * Grouped the way the select screen writes its options, so the amount the signer chose
 * reads the same on every screen of the flow, from the option they tap to the transfer.
 *
 * Cut to cents, which is as far as dollars go: the chosen amounts are whole and print
 * unchanged, but the shortfall is the amount less the balance, and that subtraction
 * leaves a floating-point tail: 25000 - 3333.76 is 21666.239999999998, which would
 * otherwise reach the screen as is.
 */
export const formatUsdAmount = (amount: number): string =>
  `$${amount.toLocaleString(FIGURE_LOCALE, { maximumFractionDigits: 2 })}`

/** Grouped for the same reason, but without the currency the units are not counted in. */
export const formatUnitCount = (units: number): string =>
  units.toLocaleString(FIGURE_LOCALE)
