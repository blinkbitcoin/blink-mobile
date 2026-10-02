import { useCallback, useRef } from "react"
import { BackHandler } from "react-native"

import { RouteProp, useFocusEffect, useNavigation } from "@react-navigation/native"
import {
  NativeStackNavigationOptions,
  NativeStackNavigationProp,
} from "@react-navigation/native-stack"

import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useIsMounted } from "@app/hooks/use-is-mounted"
import { useAuthenticationContext } from "@app/navigation/navigation-container-wrapper"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { UnlockRouteName } from "@app/navigation/unlock-routes"
import {
  listSelfCustodialAccounts,
  StorageReadStatus,
} from "@app/self-custodial/storage/account-index"
import { usePersistentStateContext } from "@app/store/persistent-state"

type UseUnlockScreenParams = {
  isResume: boolean
}

/** Where a cold start lands once the lock, if the device has one, is out of the way. */
export type ColdStartRoute = "Primary" | "getStarted"

/**
 * Where a launch with no session and no chosen account lands: on the home screen when the
 * device stores a wallet, which is the account its owner expects to find behind the lock
 * they just answered, and on the landing screen when it stores none.
 *
 * An index that cannot be read lands on the landing screen, where a launch with no session
 * always started before the gate was in front of it.
 */
const readSessionlessColdStartRoute = async (): Promise<ColdStartRoute> => {
  const wallets = await listSelfCustodialAccounts()
  const hasStoredWallet =
    wallets.status === StorageReadStatus.Ok && wallets.entries.length > 0
  return hasStoredWallet ? "Primary" : "getStarted"
}

/**
 * Blocking a resume lock from being dismissed takes one guard per platform, and neither is
 * redundant: iOS `gestureEnabled` blocks the edge swipe, Android the back press
 * `useUnlockScreen` intercepts. Only a resume turns them off; a cold start needs the gesture
 * as the only way out of the header-less PIN flow Settings opens.
 */
export const unlockScreenOptions = ({
  route,
}: {
  route: RouteProp<RootStackParamList, UnlockRouteName>
}): NativeStackNavigationOptions => ({
  headerShown: false,
  gestureEnabled: !route.params?.isResume,
})

/** Shared contract for the unlock screens: refuse dismissal while a resume lock is up, then
 *  step back on unlock, where a cold start instead routes forward. */
export const useUnlockScreen = ({ isResume }: UseUnlockScreenParams) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { setAppUnlocked } = useAuthenticationContext()
  const isAuthed = useIsAuthed()
  const { persistentState } = usePersistentStateContext()
  const isMounted = useIsMounted()

  /** Every launch starts at the gate, so the unlock screens are what decide where one
   *  lands: the home screen for a device with an account to show, the landing screen for
   *  one without. The landing screen is behind the lock like everything else, since it can
   *  open a new account, and any account lists every wallet the device stores.
   *
   *  A session or a chosen account is an account to show, as it was when the navigator
   *  asked this itself. Read when the unlock completes, not when its handler was made:
   *  the biometric prompt is handed a success handler from the screen's first render. */
  const hasSessionOrChosenAccount = isAuthed || Boolean(persistentState.activeAccountId)
  const hasSessionOrChosenAccountRef = useRef(hasSessionOrChosenAccount)
  hasSessionOrChosenAccountRef.current = hasSessionOrChosenAccount

  /** One unlock, one way out. The screen is gone once it has left, and whatever asks it
   *  to leave again, an effect that ran once more on a late change among them, would be
   *  routing from a screen that no longer exists. */
  const hasLeftRef = useRef(false)

  useFocusEffect(
    useCallback(() => {
      if (!isResume) return

      /** BackHandler, not a beforeRemove listener, so the unlock's own goBack still runs:
       *  that guard would see the stale locked state a tick later and cancel it. */
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => true)
      return () => subscription.remove()
    }, [isResume]),
  )

  const completeUnlock = useCallback(
    (navigateOnColdStart: (route: ColdStartRoute) => void) => {
      if (hasLeftRef.current) return
      hasLeftRef.current = true

      setAppUnlocked()

      if (isResume) {
        navigation.goBack()
        return
      }

      if (hasSessionOrChosenAccountRef.current) {
        navigateOnColdStart("Primary")
        return
      }

      /** Neither is there, which a logout leaves behind too, so what the device stores
       *  decides. One read, which reports a failure rather than throwing one, so the
       *  landing cannot be left waiting. A screen that went meanwhile is not routed, and
       *  a session that turned up meanwhile is an account to show after all. */
      readSessionlessColdStartRoute().then((sessionlessRoute) => {
        if (!isMounted()) return

        const coldStartRoute: ColdStartRoute = hasSessionOrChosenAccountRef.current
          ? "Primary"
          : sessionlessRoute
        navigateOnColdStart(coldStartRoute)
      })
    },
    [isResume, navigation, setAppUnlocked, isMounted],
  )

  return { completeUnlock }
}
