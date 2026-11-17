import { useCallback } from "react"
import { gql, useApolloClient } from "@apollo/client"

import { updateDeviceSessionCount } from "@app/graphql/client-only-query"
import { useGetUsernamesLazyQuery } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { reportError } from "@app/utils/error-logging"
import KeyStoreWrapper, { SessionProfilesRead } from "@app/utils/storage/secureStorage"

import { usePersistentStateContext } from "../store/persistent-state"
import { DefaultAccountId } from "../types/wallet"

import { useAppConfig } from "./use-app-config"
import { useAutoShowUpgradeModal } from "./use-show-upgrade-modal"

gql`
  query getUsernames {
    me {
      id
      phone
      username
      defaultAccount {
        id
      }
      email {
        address
      }
    }
  }
`

export const useSaveSessionProfile = () => {
  const { LL } = useI18nContext()
  const client = useApolloClient()
  const { updateState } = usePersistentStateContext()

  const {
    saveToken,
    appConfig: {
      token: currentToken,
      galoyInstance: { lnAddressHostname },
    },
  } = useAppConfig()

  const { resetUpgradeModal } = useAutoShowUpgradeModal()
  const [fetchUsername] = useGetUsernamesLazyQuery({ fetchPolicy: "no-cache" })
  const blinkUserText = LL.common.blinkUser()
  const hostName = lnAddressHostname

  const tryFetchUserProps = useCallback(
    async ({
      token,
      fetchUsername,
    }: TryFetchUserProps): Promise<ProfileProps | undefined> => {
      try {
        const { data } = await fetchUsername({
          context: { headers: { authorization: `Bearer ${token}` } },
        })

        const me = data?.me
        if (!me) return

        const { id, username, phone, email, defaultAccount } = me
        // defaultAccount can be transiently missing right after device-account
        // creation; a thrown error here would silently skip profile persistence
        const accountSuffix = defaultAccount ? ` - ${defaultAccount.id.slice(-6)}` : ""
        const identifier =
          username || phone || email?.address || `${blinkUserText}${accountSuffix}`

        return {
          userId: id,
          identifier,
          token,
          selected: true,
          phone,
          email: email?.address,
          accountId: defaultAccount?.id,
          hasUsername: Boolean(username),
          lnAddressHostname: hostName,
        }
      } catch (err) {
        reportError("save-session-profile", err)
      }
    },
    [blinkUserText, hostName],
  )

  /**
   * The stored profiles, reported as found, absent or failed. Callers that
   * write the list back must not treat a failed read as an empty store:
   * profiles carry their sessions' tokens, so a list rewritten from an assumed
   * emptiness signs every other saved account out.
   */
  const readProfiles = useCallback(async (): Promise<SessionProfilesRead> => {
    const read = await KeyStoreWrapper.readSessionProfiles()
    if (read.status === "failed") reportError("read session profiles", read.err)
    return read
  }, [])

  const saveProfile = useCallback(
    async (token: string): Promise<void> => {
      if (!token) return

      await saveToken(token)
      updateState((prev) => {
        if (!prev) return prev
        return { ...prev, activeAccountId: DefaultAccountId.Custodial }
      })

      const read = await readProfiles()
      const profiles = read.status === "found" ? read.profiles : []

      // A profile stored without accountId was saved while defaultAccount was
      // still missing; fall through and re-fetch so this login heals it
      const alreadyStored = profiles.find((p) => p.token === token)
      if (alreadyStored?.accountId) return

      const profile = await tryFetchUserProps({ token, fetchUsername })
      if (!profile) return

      resetUpgradeModal()
      updateDeviceSessionCount(client, { reset: true })

      // Only the write is skipped when the store could not be read: the login
      // above stands, and the resets belong to it rather than to the list.
      if (read.status === "failed") return

      const others = profiles.filter((p) => p.token !== token)
      const exists =
        profile.accountId !== undefined &&
        others.some((p) => p.accountId === profile.accountId)
      const cleaned = others.map((p) => ({ ...p, selected: false }))
      if (!exists) {
        await KeyStoreWrapper.saveSessionProfiles([{ ...profile }, ...cleaned])
        return
      }

      // Update profile for the previously saved session
      const updatedProfiles = cleaned.map((p) =>
        p.accountId === profile.accountId ? { ...profile, selected: true } : p,
      )

      await KeyStoreWrapper.saveSessionProfiles(updatedProfiles)
    },
    [
      saveToken,
      updateState,
      readProfiles,
      tryFetchUserProps,
      fetchUsername,
      resetUpgradeModal,
      client,
    ],
  )

  const updateCurrentProfile = useCallback(async (): Promise<void> => {
    // This method only rewrites entries that already exist, so anything but a
    // list in hand means there is nothing to update — and writing one back
    // would be indistinguishable from a wipe.
    const read = await readProfiles()
    if (read.status !== "found") return
    const profiles = read.profiles

    const currentProfile = await tryFetchUserProps({ token: currentToken, fetchUsername })
    if (!currentProfile) return
    const updatedProfiles = profiles.map((p) => {
      const sameAccount =
        currentProfile.accountId !== undefined && p.accountId === currentProfile.accountId
      // token match heals a profile saved while its accountId was still missing
      return sameAccount || p.token === currentProfile.token ? currentProfile : p
    })
    await KeyStoreWrapper.saveSessionProfiles(updatedProfiles)
  }, [readProfiles, fetchUsername, tryFetchUserProps, currentToken])

  return {
    saveProfile,
    updateCurrentProfile,
  }
}
