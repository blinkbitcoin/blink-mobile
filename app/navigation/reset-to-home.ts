import { CommonActions } from "@react-navigation/native"

/** Out of whatever flow is open, with nothing of it left to go back to. */
export const RESET_TO_HOME = CommonActions.reset({
  index: 0,
  routes: [{ name: "Primary" }],
})
