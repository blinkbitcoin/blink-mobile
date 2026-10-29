import { CommonActions } from "@react-navigation/native"
import { type NativeStackNavigationProp } from "@react-navigation/native-stack"

import { type RootStackParamList } from "@app/navigation/stack-param-lists"
import { type DeleteAccountOutcome } from "@app/self-custodial/hooks/use-delete-account"

/** Every outcome takes the removed account's screen off the stack. Its lock stays up
 *  while it leaves, so a screen left underneath would keep that lock: a dead screen to
 *  come back to, with the header back control hidden and the swipe off. */
export const navigateAfterAccountDelete = (
  navigation: NativeStackNavigationProp<RootStackParamList>,
  outcome: DeleteAccountOutcome,
): void => {
  switch (outcome) {
    case "switched-to-self-custodial":
      navigation.popTo("Primary")
      return
    case "remained":
    case "switched-to-custodial":
      navigation.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: "Primary" }] }),
      )
      return
    case "logged-out":
      navigation.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: "getStarted" }] }),
      )
  }
}
