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
  const { saveToken } = useAppConfig()
  const { resetUpgradeModal } = useAutoShowUpgradeModal()
  const [fetchUsername] = useGetUsernamesLazyQuery({ fetchPolicy: "no-cache" })

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
          `${LL.common.blinkUser()} - ${defaultAccount.id.slice(-6)}`

        return {
          userId: id,
          identifier,
          token,
          selected: true,
          phone,
          email: email?.address,
          accountId: defaultAccount?.id,
        }
      } catch (err) {
        if (err instanceof Error) crashlytics().recordError(err)
      }
    },
    [LL.common],
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
      if (!exists) {
        const cleaned = profiles.map((p) => ({ ...p, selected: false }))
        await KeyStoreWrapper.saveSessionProfiles([{ ...profile }, ...cleaned])
      }
    },
    [saveToken, tryFetchUserProps, fetchUsername, resetUpgradeModal, client],
  )

  return {
    saveProfile,
  }
}
