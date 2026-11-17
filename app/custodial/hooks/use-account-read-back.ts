import { useCallback } from "react"

import {
  SettingsScreenQuery,
  useSettingsScreenLazyQuery,
  useSettingsScreenQuery,
} from "@app/graphql/generated"

type AccountRead = NonNullable<SettingsScreenQuery["me"]>

/**
 * Reads the account back from the network, for a change whose answer was lost or
 * refused but may have landed anyway. Only the account the change was sent for counts:
 * a session switched meanwhile reads another one, and a read that fails proves nothing.
 */
export const useAccountReadBack = () => {
  const [readAccount] = useSettingsScreenLazyQuery({ fetchPolicy: "network-only" })
  /** The account a change is sent for, as the settings read it. */
  const { data } = useSettingsScreenQuery({ fetchPolicy: "cache-only" })
  const accountId = data?.me?.id

  /** The account as the server has it now, or null when it is not the one the change
   *  was sent for or cannot be read. */
  const readBack = useCallback(
    async (sentFor: string | undefined): Promise<AccountRead | null> => {
      try {
        const { data: read, error } = await readAccount()
        if (error) return null
        const me = read?.me
        if (!me) return null
        const isAccountSentFor = me.id === sentFor
        return isAccountSentFor ? me : null
      } catch {
        return null
      }
    },
    [readAccount],
  )

  return { accountId, readBack }
}
