import { CommonActions, type NavigationProp } from "@react-navigation/native"

import { type RootStackParamList } from "@app/navigation/stack-param-lists"
import { type DeleteAccountOutcome } from "@app/self-custodial/hooks/use-delete-account"

export const navigateAfterAccountDelete = (
  navigation: NavigationProp<RootStackParamList>,
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
    case "logged-out":
      navigation.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: "getStarted" }] }),
      )
  }
}
