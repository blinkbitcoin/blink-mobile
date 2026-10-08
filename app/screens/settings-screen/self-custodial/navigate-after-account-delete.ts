import { CommonActions } from "@react-navigation/native"
import { type NativeStackNavigationProp } from "@react-navigation/native-stack"

import { type RootStackParamList } from "@app/navigation/stack-param-lists"
import { type DeleteAccountOutcome } from "@app/self-custodial/hooks/use-delete-account"

export const navigateAfterAccountDelete = (
  navigation: NativeStackNavigationProp<RootStackParamList>,
  outcome: DeleteAccountOutcome,
): void => {
  switch (outcome) {
    case "switched-to-self-custodial":
      navigation.navigate("Primary")
      return
    case "remained":
    case "switched-to-custodial":
      navigation.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: "Primary" }] }),
      )
      return
    /** Nothing was deleted, so there is nowhere to go: the user stays where they are, on a
     *  screen whose own copy already says why the wallet cannot be removed yet. */
    case "blocked":
    case "record-unavailable":
      return
    case "logged-out":
      navigation.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: "getStarted" }] }),
      )
  }
}
