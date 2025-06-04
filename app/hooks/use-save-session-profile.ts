import { useCallback } from "react"
import { gql } from "@apollo/client"
import crashlytics from "@react-native-firebase/crashlytics"

import { useGetUsernamesLazyQuery } from "@app/graphql/generated"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useAppConfig } from "./use-app-config"

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
  const { saveToken } = useAppConfig()
  const [fetchUsername] = useGetUsernamesLazyQuery({ fetchPolicy: "no-cache" })
  const blinkUserText = LL.common.blinkUser()

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
        }
      } catch (err) {
        if (err instanceof Error) crashlytics().recordError(err)
      }
    },
    [blinkUserText],
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
    [saveToken, tryFetchUserProps, fetchUsername],
  )

  return {
    saveProfile,
  }
}
