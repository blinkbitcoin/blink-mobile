import { CommonActions } from "@react-navigation/native"
import { type NativeStackNavigationProp } from "@react-navigation/native-stack"

import { type RootStackParamList } from "@app/navigation/stack-param-lists"
import { type DeleteAccountOutcome } from "@app/self-custodial/hooks/use-delete-account"

export const navigateAfterAccountDelete = (
  navigation: NativeStackNavigationProp<RootStackParamList>,
  outcome: DeleteAccountOutcome,
): void => {
  switch (outcome) {
    /** Neither end of the session is routed from here. This navigator cannot move the lock
     *  flag, and both outcomes need it moved: one is owed an answer and has to keep it
     *  raised, the other took the lock with it and has to lower it. The caller sends both
     *  through the shared logout route, which owns that flag. */
    case "logged-out":
    case "logged-out-locked":
      return
    case "switched-to-self-custodial":
      navigation.navigate("Primary")
      return
    case "remained":
    case "switched-to-custodial":
      navigation.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: "Primary" }] }),
      )
  }
}
