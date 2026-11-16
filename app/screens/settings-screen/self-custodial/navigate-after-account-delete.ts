import { CommonActions } from "@react-navigation/native"
import { type NativeStackNavigationProp } from "@react-navigation/native-stack"

import { type RootStackParamList } from "@app/navigation/stack-param-lists"
import { type DeleteAccountOutcome } from "@app/self-custodial/hooks/use-delete-account"

/**
 * Where a self-custodial delete lands, in one place for every screen that deletes.
 *
 * Every outcome takes the removed account's screen off the stack. Its lock stays up
 * while it leaves, so a screen left underneath would keep that lock: a dead screen to
 * come back to, with the header back control hidden and the swipe off.
 *
 * Both ends of the session go through the shared logout route, which owns the lock flag: a
 * lock the wipe could not take is owed an answer and returns to the gate, and one the wipe
 * did take has to lower the flag with it, or a relock raised mid-delete would park every
 * deep link behind a lock that no longer exists.
 */
export const navigateAfterAccountDelete = (
  navigation: NativeStackNavigationProp<RootStackParamList>,
  routeAfterLogout: (isAppLockKept: boolean) => void,
  outcome: DeleteAccountOutcome,
): void => {
  switch (outcome) {
    case "logged-out":
      routeAfterLogout(false)
      return
    case "logged-out-locked":
      routeAfterLogout(true)
      return
    case "switched-to-self-custodial":
      /** `navigate` would push a second Primary and leave the locked screen underneath. */
      navigation.popTo("Primary")
      return
    case "remained":
    case "switched-to-custodial":
      navigation.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: "Primary" }] }),
      )
  }
}
