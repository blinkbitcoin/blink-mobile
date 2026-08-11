import { useFeatureFlags } from "@app/config/feature-flags-context"

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
}

/**
 * Which account types exist to be offered, which no longer depends on where the user is:
 * region rules belong to useCreationBlock, evaluated once an option has been chosen. Both
 * options are shown and a refused one is answered on continue, so nobody is located for
 * merely looking at the screen.
 */
export const useAccountTypeOptions = (): AccountTypeOptionsResult => {
  const { nonCustodialEnabled } = useFeatureFlags()

  const options: AccountOption[] = []
  if (nonCustodialEnabled) options.push(AccountOption.SelfCustodial)
  options.push(AccountOption.Custodial)

  return {
    options,
    defaultSelected: options.length === 1 ? options[0] : null,
    selfCustodialTemporarilyDisabled: !nonCustodialEnabled,
  }
}
