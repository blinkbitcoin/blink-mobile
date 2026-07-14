/**
 * TODO: TEMPORARY central mock of the backend migration/wind-down contract: every value
 * here must be replaced by the real backend query once it is ready. Nothing outside this
 * file hardcodes wind-down data: screens read it through hooks (useWindDownStatus,
 * useMigrationPreview), so swapping the mock for the real query later touches only this
 * layer. The durable contract types live in @app/types/wind-down and survive this file.
 */
import { AccountMigrationPreview, WindDown, WindDownStatus } from "@app/types/wind-down"

const toUnixSeconds = (utcMilliseconds: number): number => utcMilliseconds / 1000

/**
 * Flip to false to simulate an account the wind-down does not affect: the backend then
 * omits `Account.windDown` entirely (null) and no wind-down UI may render at all.
 */
const IS_ACCOUNT_AFFECTED: boolean = true

/**
 * TODO: TEMPORARY, replace with the backend wind-down status query (Account.windDown)
 * once it is ready. The dates below are the published wind-down timeline; 00:00 in
 * Europe/Paris is 22:00 UTC of the previous day because August/September fall in CEST
 * (UTC+2). Change `status` here (or via the developer-screen simulations later) to see
 * each phase's UI.
 */
export const windDownMock: WindDown | null = IS_ACCOUNT_AFFECTED
  ? {
      status: WindDownStatus.PreCutoff,
      /** Aug 1 2026, 00:00 Europe/Paris: receiving disabled from this moment. */
      receiveDisabledAt: toUnixSeconds(Date.UTC(2026, 6, 31, 22, 0, 0)),
      /** Aug 31 2026, end of day Europe/Paris: last day to initiate an exit. */
      finalDeadline: toUnixSeconds(Date.UTC(2026, 7, 31, 21, 59, 59)),
      /** Sep 1 2026, 00:00 Europe/Paris: the blocking migration gate arms. */
      gateArmsAt: toUnixSeconds(Date.UTC(2026, 7, 31, 22, 0, 0)),
      timezone: "Europe/Paris",
    }
  : null

const MOCK_NETWORK_FEE_SATS = 10
const MOCK_DE_MINIMIS_THRESHOLD_SATS = 100

/**
 * TODO: TEMPORARY, replace with the backend migration preview query once it ships.
 * Replicates the backend getMigrationPreview branch by branch: zero balance gets a zero
 * preview, a balance at or below the de-minimis threshold (100 sats) has its fee covered
 * by Blink and transfers whole, and anything above pays the network fee (mocked at the
 * 10-sat Lightning-to-Spark minimum).
 */
export const getMigrationPreviewMock = (balanceSats: number): AccountMigrationPreview => {
  if (balanceSats <= 0) {
    return { balanceSats: 0, feeSats: 0, feeCoveredByBlink: false, receiveSats: 0 }
  }

  if (balanceSats <= MOCK_DE_MINIMIS_THRESHOLD_SATS) {
    return {
      balanceSats,
      feeSats: MOCK_NETWORK_FEE_SATS,
      feeCoveredByBlink: true,
      receiveSats: balanceSats,
    }
  }

  return {
    balanceSats,
    feeSats: MOCK_NETWORK_FEE_SATS,
    feeCoveredByBlink: false,
    receiveSats: balanceSats - MOCK_NETWORK_FEE_SATS,
  }
}
