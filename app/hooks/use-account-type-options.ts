import { isCustodialAllowedForCountry } from "@app/config/custodial-eligibility"
import { useFeatureFlags } from "@app/config/feature-flags-context"
import { AccountTypeMode } from "@app/types/account"

import useDeviceLocation from "./use-device-location"

export const AccountOption = {
  Custodial: "custodial",
  SelfCustodial: "selfCustodial",
} as const

export type AccountOption = (typeof AccountOption)[keyof typeof AccountOption]

type AccountTypeOptionsResult = {
  options: AccountOption[]
  defaultSelected: AccountOption | null
  selfCustodialTemporarilyDisabled: boolean
  loading: boolean
}

export const useAccountTypeOptions = (
  mode: AccountTypeMode = AccountTypeMode.Create,
): AccountTypeOptionsResult => {
  const { nonCustodialEnabled } = useFeatureFlags()
  const { countryCode, loading } = useDeviceLocation()

  const isRestore = mode === AccountTypeMode.Restore
  const custodialAllowed = isRestore || isCustodialAllowedForCountry(countryCode)

  const options: AccountOption[] = []
  if (nonCustodialEnabled) options.push(AccountOption.SelfCustodial)
  if (custodialAllowed) options.push(AccountOption.Custodial)

  return {
    options,
    defaultSelected: options.length === 1 ? options[0] : null,
    selfCustodialTemporarilyDisabled: !nonCustodialEnabled,
    loading: isRestore ? false : loading,
  }
}
