import { CountryCode } from "libphonenumber-js/mobile"

import { useRemoteConfig } from "@app/config/feature-flags-context"
import { AccountType } from "@app/types/wallet"

import useDeviceLocation, {
  isBlockedCountry,
  useIpCountryCode,
} from "./use-device-location"
import { useActiveWallet } from "./use-active-wallet"

/**
 * Gating on accountType (not isSelfCustodial) keeps the restriction stable through the
 * self-custodial cold-start window while the SDK connects; passing `accountTypeOverride`
 * evaluates a specific account type's block-list (e.g. predicting the self-custodial
 * dollar restriction from the still-custodial session during migration).
 */
const useDollarBalanceBlockedCountries = (
  accountTypeOverride?: AccountType,
): string[] => {
  const { accountType: activeAccountType } = useActiveWallet()
  const accountType = accountTypeOverride ?? activeAccountType
  const {
    custodialDollarBalanceBlockedCountries,
    selfCustodialDollarBalanceBlockedCountries,
  } = useRemoteConfig()

  return accountType === AccountType.SelfCustodial
    ? selfCustodialDollarBalanceBlockedCountries
    : custodialDollarBalanceBlockedCountries
}

/**
 * The country whose block-list decides the restriction. A self-custodial account has no
 * phone, so evaluating its policy resolves by IP; every other case reads the device's own
 * country. The IP wins whenever it resolves, but while predicting the self-custodial policy
 * from a still-custodial session an unreachable IP falls back to the session country, so a
 * failed IP lookup does not read as unrestricted and preview a dollar balance the account
 * cannot hold.
 */
const useRestrictionRegion = (
  accountTypeOverride?: AccountType,
): CountryCode | undefined => {
  const { countryCode: deviceCountryCode } = useDeviceLocation()

  const isSelfCustodialPrediction = accountTypeOverride === AccountType.SelfCustodial
  const ipCountryCode = useIpCountryCode(isSelfCustodialPrediction)

  return isSelfCustodialPrediction
    ? ipCountryCode ?? deviceCountryCode
    : deviceCountryCode
}

export const useDollarBalanceRestricted = (
  accountTypeOverride?: AccountType,
): boolean => {
  const blockedCountries = useDollarBalanceBlockedCountries(accountTypeOverride)
  const regionCountryCode = useRestrictionRegion(accountTypeOverride)

  return isBlockedCountry(regionCountryCode, blockedCountries)
}
