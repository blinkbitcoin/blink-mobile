import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { useAppConfig } from "@app/hooks"
import useLogout from "@app/hooks/use-logout"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { reportError } from "@app/utils/error-logging"
import { toastShow } from "@app/utils/toast"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

/**
 * Why this is not just `ProfileProps | undefined`: callers answer "no other
 * profile" with a full logout, which erases every saved session. Collapsing a
 * failed read into that answer would delete the very profiles the read could
 * not see, so the unreadable case has to reach the caller as its own outcome.
 */
export const SwitchProfileOutcome = {
  Switched: "switched",
  NoOtherProfile: "noOtherProfile",
  ProfilesUnreadable: "profilesUnreadable",
} as const
export type SwitchProfileOutcome =
  (typeof SwitchProfileOutcome)[keyof typeof SwitchProfileOutcome]

type UseSwitchToNextProfileResult = {
  switchToNextProfile: (tokenToDeactivate: string) => Promise<SwitchProfileOutcome>
}

export const useSwitchToNextProfile = (): UseSwitchToNextProfileResult => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { logout } = useLogout()
  const { saveToken } = useAppConfig()
  const { LL } = useI18nContext()

  const switchToNextProfile = async (
    tokenToDeactivate: string,
  ): Promise<SwitchProfileOutcome> => {
    const read = await KeyStoreWrapper.readSessionProfiles()
    const profiles = read.status === "found" ? read.profiles : []
    const nextProfile = profiles.find((profile) => profile.token !== tokenToDeactivate)

    // The dead session goes either way: this deactivation is scoped to its own
    // token and never rewrites the list from an empty read.
    await logout({
      stateToDefault: false,
      token: tokenToDeactivate,
      isValidToken: false,
    })

    if (read.status === "failed") {
      reportError("switch to next profile", read.err)
      return SwitchProfileOutcome.ProfilesUnreadable
    }

    if (!nextProfile) return SwitchProfileOutcome.NoOtherProfile

    await saveToken(nextProfile.token)
    toastShow({
      type: "success",
      message: LL.ProfileScreen.switchAccount(),
      LL,
    })
    navigation.navigate("Primary")
    return SwitchProfileOutcome.Switched
  }

  return { switchToNextProfile }
}
