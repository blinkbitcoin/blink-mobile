import { CommonActions } from "@react-navigation/native"
import { type NativeStackNavigationProp } from "@react-navigation/native-stack"

import { type RootStackParamList } from "@app/navigation/stack-param-lists"
import { navigateAfterAccountDelete } from "@app/screens/settings-screen/self-custodial/navigate-after-account-delete"

const buildNavigation = () => {
  const dispatch = jest.fn()
  const navigate = jest.fn()
  return {
    navigation: {
      dispatch,
      navigate,
    } as unknown as NativeStackNavigationProp<RootStackParamList>,
    dispatch,
    navigate,
  }
}

describe("navigateAfterAccountDelete", () => {
  it("soft-navigates to Primary when the user switched to another self-custodial account", () => {
    const { navigation, dispatch, navigate } = buildNavigation()

    navigateAfterAccountDelete(navigation, "switched-to-self-custodial")

    expect(navigate).toHaveBeenCalledWith("Primary")
    expect(dispatch).not.toHaveBeenCalled()
  })

  it("resets the stack to Primary when the user remained on their current account", () => {
    const { navigation, dispatch, navigate } = buildNavigation()

    navigateAfterAccountDelete(navigation, "remained")

    expect(dispatch).toHaveBeenCalledWith(
      CommonActions.reset({ index: 0, routes: [{ name: "Primary" }] }),
    )
    expect(navigate).not.toHaveBeenCalled()
  })

  it("resets the stack to Primary when the user switched to the custodial account", () => {
    const { navigation, dispatch, navigate } = buildNavigation()

    navigateAfterAccountDelete(navigation, "switched-to-custodial")

    expect(dispatch).toHaveBeenCalledWith(
      CommonActions.reset({ index: 0, routes: [{ name: "Primary" }] }),
    )
    expect(navigate).not.toHaveBeenCalled()
  })

  /** Both ends of the session belong to the caller, which owns the lock flag this
   *  navigator cannot touch: one outcome is owed an answer and has to keep the flag
   *  raised, the other took the lock with it and has to lower it. Routing either from
   *  here would move the screen and leave the flag behind. */
  it("navigates nowhere when the session ended and the lock went with it", () => {
    const { navigation, dispatch, navigate } = buildNavigation()

    navigateAfterAccountDelete(navigation, "logged-out")

    expect(dispatch).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })

  it("navigates nowhere when the session ended with the lock still standing", () => {
    const { navigation, dispatch, navigate } = buildNavigation()

    navigateAfterAccountDelete(navigation, "logged-out-locked")

    expect(dispatch).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })
})
