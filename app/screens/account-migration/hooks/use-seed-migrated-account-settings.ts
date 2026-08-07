import { useCallback } from "react"

import { useDisplayCurrencyQuery, useLanguageQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { usePersistentStateContext } from "@app/store/persistent-state"
import { seedMigratedAccountSettings } from "@app/store/persistent-state/migrated-account-settings"

/** Captures the custodial account's display currency and language (and, via the local
 *  theme map, its theme) onto a migration-provisioned account. Mounted alongside the
 *  migration flow so the cache-first queries warm over the network while the custodial
 *  session is still live — the completion/resume path runs after logout, when the
 *  server values are unreachable. Best-effort: unknown values are simply not seeded. */
export const useSeedMigratedAccountSettings = () => {
  const isAuthed = useIsAuthed()
  const { updateState } = usePersistentStateContext()

  const { data: currencyData } = useDisplayCurrencyQuery({
    fetchPolicy: "cache-first",
    skip: !isAuthed,
  })
  const { data: languageData } = useLanguageQuery({
    fetchPolicy: "cache-first",
    skip: !isAuthed,
  })

  const seedMigratedSettings = useCallback(
    (accountId: string) => {
      updateState(
        (prev) =>
          prev &&
          seedMigratedAccountSettings(prev, accountId, {
            displayCurrency: currencyData?.me?.defaultAccount?.displayCurrency ?? null,
            language: languageData?.me?.language ?? null,
          }),
      )
    },
    [currencyData, languageData, updateState],
  )

  return { seedMigratedSettings }
}
