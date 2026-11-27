import { AccountMode } from "@app/types/account"

/**
 * Whether the log export may carry the install's analytics id (Telemetry PRD 2, R27,
 * KB-26): only when the active account is Enhanced, and only when every self-custodial
 * wallet on the device is Enhanced too.
 *
 * The second half matters because the file holds the logs and wallet identifiers of every
 * self-custodial wallet on the device, not only the active one. An Incognito wallet, or
 * one with no mode yet, must never end up in the same file as the id its install reports
 * under: Incognito gets no analytics id, and that holds even inside one support case.
 *
 * `activeMode` is null while custodial is active or the active wallet has no mode.
 */
export const shouldIncludeAnalyticsId = ({
  activeMode,
  selfCustodialModes,
}: {
  activeMode: AccountMode | null
  selfCustodialModes: ReadonlyArray<AccountMode | null>
}): boolean =>
  activeMode === AccountMode.Enhanced &&
  selfCustodialModes.every((mode) => mode === AccountMode.Enhanced)
