import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { useAppConfig } from "@app/hooks"
import useLogout from "@app/hooks/use-logout"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { toastShow } from "@app/utils/toast"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

type UseSwitchToNextProfileResult = {
  switchToNextProfile: (tokenToDeactivate: string) => Promise<ProfileProps | undefined>
}

export const useSwitchToNextProfile = (): UseSwitchToNextProfileResult => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const { logout } = useLogout()
  const { saveToken } = useAppConfig()
  const { LL } = useI18nContext()

  const switchToNextProfile = async (
    tokenToDeactivate: string,
  ): Promise<ProfileProps | undefined> => {
    const profiles = await KeyStoreWrapper.getSessionProfiles()
    const nextProfile = profiles.find((profile) => profile.token !== tokenToDeactivate)

    await logout({
      stateToDefault: false,
      token: tokenToDeactivate,
      isValidToken: false,
    })

    if (nextProfile) {
      await saveToken(nextProfile.token)
      toastShow({
        type: "success",
        message: LL.ProfileScreen.switchAccount(),
        LL,
      })
      navigation.navigate("Primary")
    }
    return nextProfile
  }

  return { switchToNextProfile }
}
