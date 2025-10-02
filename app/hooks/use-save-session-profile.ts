import { useCallback } from "react"
import { gql, useApolloClient } from "@apollo/client"
import crashlytics from "@react-native-firebase/crashlytics"

import { updateDeviceSessionCount } from "@app/graphql/client-only-query"
import { useGetUsernamesLazyQuery } from "@app/graphql/generated"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"
import { useI18nContext } from "@app/i18n/i18n-react"

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
        const identifier =
          username ||
          phone ||
          email?.address ||
          `${blinkUserText} - ${defaultAccount.id.slice(-6)}`

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
        if (err instanceof Error) crashlytics().recordError(err)
      }
    },
    [blinkUserText, hostName],
  )

  const saveProfile = useCallback(
    async (token: string): Promise<void> => {
      if (!token) return

      await saveToken(token)

      const profiles = await KeyStoreWrapper.getSessionProfiles()

      const alreadyStored = profiles.find((p) => p.token === token)
      if (alreadyStored) return

      const profile = await tryFetchUserProps({ token, fetchUsername })
      if (!profile) return

      resetUpgradeModal()
      updateDeviceSessionCount(client, { reset: true })

      const exists = profiles.some((p) => p.accountId === profile.accountId)
      const cleaned = profiles.map((p) => ({ ...p, selected: false }))
      if (!exists) {
        await KeyStoreWrapper.saveSessionProfiles([{ ...profile }, ...cleaned])
        return
      }

      // Update token for the previously saved session
      const updatedProfiles = cleaned.map((p) =>
        p.accountId === profile.accountId ? { ...p, token: profile.token } : p,
      )

      await KeyStoreWrapper.saveSessionProfiles(updatedProfiles)
    },
    [saveToken, tryFetchUserProps, fetchUsername, resetUpgradeModal, client],
  )

  const updateCurrentProfile = useCallback(async (): Promise<void> => {
    const profiles = await KeyStoreWrapper.getSessionProfiles()
    const currentProfile = await tryFetchUserProps({ token: currentToken, fetchUsername })
    if (!currentProfile) return
    const updatedProfiles = profiles.map((p) =>
      p.accountId === currentProfile.accountId ? currentProfile : p,
    )
    await KeyStoreWrapper.saveSessionProfiles(updatedProfiles)
  }, [fetchUsername, tryFetchUserProps, currentToken])

  return {
    saveProfile,
    updateCurrentProfile,
  }
}
