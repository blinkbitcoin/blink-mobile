import { useCallback } from "react"

import { useApolloClient } from "@apollo/client"

import {
  DisplayCurrencyDocument,
  DisplayCurrencyQuery,
  LanguageDocument,
  LanguageQuery,
  useDisplayCurrencyLazyQuery,
  useLanguageLazyQuery,
} from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { usePersistentStateContext } from "@app/store/persistent-state"
import {
  CustodialSettingsSnapshot,
  seedMigratedAccountSettings,
} from "@app/store/persistent-state/migrated-account-settings"
import { withTimeout } from "@app/utils/with-timeout"

/** The settings copy must never delay or fail the migration it rides along with, so a
 *  slow server is abandoned for the cached values rather than waited out. */
const FETCH_TIMEOUT_MS = 2000

const EMPTY_SNAPSHOT: CustodialSettingsSnapshot = {
  displayCurrency: null,
  language: null,
}

/** Copies the custodial account's display currency and language (and, via the local theme
 *  map, its theme) onto the migration's self-custodial account. Called at completion,
 *  while the custodial session is still live — `completeMigration` performs the logout
 *  itself, so everything before that line can still reach the server (#4099).
 *
 *  Values are fetched on demand instead of read from a mounted query: the caller may run
 *  on a resume launch that never opened the migration screens, where no query has warmed
 *  the cache. Best-effort per field — whatever cannot be resolved is left unseeded so the
 *  account keeps today's fallback instead of freezing a wrong guess. */
export const useSeedMigratedAccountSettings = () => {
  const isAuthed = useIsAuthed()
  const client = useApolloClient()
  const { updateState } = usePersistentStateContext()

  const [fetchDisplayCurrency] = useDisplayCurrencyLazyQuery({ fetchPolicy: "no-cache" })
  const [fetchLanguage] = useLanguageLazyQuery({ fetchPolicy: "no-cache" })

  /** Offline, timed out, or already logged out: the app-wide queries that run on every
   *  authed launch usually left the right values behind, so the cache is a real answer
   *  rather than a consolation prize. */
  const readCachedSnapshot = useCallback((): CustodialSettingsSnapshot => {
    try {
      const currency = client.readQuery<DisplayCurrencyQuery>({
        query: DisplayCurrencyDocument,
      })
      const language = client.readQuery<LanguageQuery>({ query: LanguageDocument })
      return {
        displayCurrency: currency?.me?.defaultAccount?.displayCurrency ?? null,
        language: language?.me?.language ?? null,
      }
    } catch {
      return EMPTY_SNAPSHOT
    }
  }, [client])

  const fetchSnapshot = useCallback(async (): Promise<CustodialSettingsSnapshot> => {
    if (!isAuthed) return EMPTY_SNAPSHOT
    try {
      const [currency, language] = await withTimeout(
        Promise.all([fetchDisplayCurrency(), fetchLanguage()]),
        FETCH_TIMEOUT_MS,
        "Migration settings fetch",
      )
      return {
        displayCurrency: currency.data?.me?.defaultAccount?.displayCurrency ?? null,
        language: language.data?.me?.language ?? null,
      }
    } catch {
      return EMPTY_SNAPSHOT
    }
  }, [isAuthed, fetchDisplayCurrency, fetchLanguage])

  const seedMigratedSettings = useCallback(
    async (accountId: string) => {
      const fetched = await fetchSnapshot()
      const cached = readCachedSnapshot()
      /** Merged per field, not per snapshot: a fetch that answered for one value and not
       *  the other still contributes what it knows. */
      const snapshot: CustodialSettingsSnapshot = {
        displayCurrency: fetched.displayCurrency ?? cached.displayCurrency,
        language: fetched.language ?? cached.language,
      }
      updateState(
        (prev) => prev && seedMigratedAccountSettings(prev, accountId, snapshot),
      )
    },
    [fetchSnapshot, readCachedSnapshot, updateState],
  )

  return { seedMigratedSettings }
}
