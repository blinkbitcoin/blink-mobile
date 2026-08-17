import { useSettingsScreenQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useLevel } from "@app/graphql/level-context"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import type { SecuritySignalDescriptor } from "@app/types/security-score"
import { AccountType } from "@app/types/wallet"

type CustodialSecurityInputs = {
  totpEnabled: boolean
  emailVerified: boolean
}

export const custodialSecuritySignals = ({
  totpEnabled,
  emailVerified,
}: CustodialSecurityInputs): SecuritySignalDescriptor[] => [
  { key: "twoFactor", done: totpEnabled, retriggerable: false },
  { key: "emailVerified", done: emailVerified, retriggerable: false },
]

/**
 * The custodial contribution to the security score; null when not our mode.
 * Level 0 gets an empty list: settings hides the login-methods group there,
 * so offering email/2FA "Set" rows would point at flows the account can't use.
 */
export const useCustodialSecuritySignals = (): SecuritySignalDescriptor[] | null => {
  const { activeAccount } = useAccountRegistry()
  const isAuthed = useIsAuthed()
  const { isAtLeastLevelOne } = useLevel()
  const { data } = useSettingsScreenQuery({
    skip: !isAuthed,
    fetchPolicy: "cache-and-network",
  })

  if (activeAccount?.type !== AccountType.Custodial) return null
  if (!isAtLeastLevelOne) return []

  return custodialSecuritySignals({
    totpEnabled: Boolean(data?.me?.totpEnabled),
    emailVerified: Boolean(data?.me?.email?.address && data?.me?.email?.verified),
  })
}
