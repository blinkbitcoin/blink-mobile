import { useEffect, useRef } from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { useAppConfig } from "@app/hooks"
import useLogout from "@app/hooks/use-logout"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useAuthenticationContext } from "@app/navigation/navigation-container-wrapper"
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
  const { isAppLocked } = useAuthenticationContext()

  /**
   * Mirrored because the switch reads the lock long after it started: the profile read, the
   * logout and the token save all await, and a background-and-resume during any of them
   * raises the lock while the value captured at the call still says unlocked. Navigating on
   * that one puts the switched session on top of the lock screen it just raised.
   */
  const isAppLockedRef = useRef(isAppLocked)
  useEffect(() => {
    isAppLockedRef.current = isAppLocked
  }, [isAppLocked])

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
    /** Behind a lock that has not been answered, the switch changes which
     *  session is waiting, not which screen is up: a session can die while the
     *  lock screen is the one on show, and the home screen pushed from here
     *  would sit on top of it. Answering the lock is what lands on home.
     *
     *  Read now rather than at the call: a lock raised during the awaits above
     *  is one this navigation would land on top of. */
    if (!isAppLockedRef.current) navigation.navigate("Primary")
    return SwitchProfileOutcome.Switched
  }

  return { switchToNextProfile }
}
