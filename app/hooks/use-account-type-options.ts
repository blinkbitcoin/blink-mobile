import { useFeatureFlags } from "@app/config/feature-flags-context"
import { AccountTypeMode } from "@app/types/account"

import { useCustodialEligibility } from "./use-custodial-eligibility"

export const AccountOption = {
  Custodial: "custodial",
  SelfCustodial: "selfCustodial",
} as const

export type AccountOption = (typeof AccountOption)[keyof typeof AccountOption]

export const AccountFlow = {
  Trial: "trial",
  SelfCustodial: "selfCustodial",
} as const

export type AccountFlow = (typeof AccountFlow)[keyof typeof AccountFlow]

/**
 * Exhaustive map from an account option to the create-flow it enters.
 * Adding a third `AccountOption` will fail to compile until this map
 * declares its flow, preventing a silent fall-through.
 */
export const ACCOUNT_OPTION_TO_FLOW: Record<AccountOption, AccountFlow> = {
  [AccountOption.Custodial]: AccountFlow.Trial,
  [AccountOption.SelfCustodial]: AccountFlow.SelfCustodial,
}

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
  const { signupAllowed, loading } = useCustodialEligibility()

  const isRestore = mode === AccountTypeMode.Restore
  const custodialAvailable = isRestore || signupAllowed

  const options: AccountOption[] = []
  if (nonCustodialEnabled) options.push(AccountOption.SelfCustodial)
  if (custodialAvailable) options.push(AccountOption.Custodial)

  return {
    options,
    defaultSelected: options.length === 1 ? options[0] : null,
    selfCustodialTemporarilyDisabled: !nonCustodialEnabled,
    loading: isRestore ? false : loading,
  }
}
