import { CommonActions, type NavigationProp } from "@react-navigation/native"

import { type RootStackParamList } from "@app/navigation/stack-param-lists"
import { navigateAfterAccountDelete } from "@app/screens/settings-screen/self-custodial/navigate-after-account-delete"

const buildNavigation = () => {
  const dispatch = jest.fn()
  const navigate = jest.fn()
  return {
    navigation: {
      dispatch,
      navigate,
    } as unknown as NavigationProp<RootStackParamList>,
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

  it("resets the stack to getStarted when the user has no account left", () => {
    const { navigation, dispatch, navigate } = buildNavigation()

    navigateAfterAccountDelete(navigation, "logged-out")

    expect(dispatch).toHaveBeenCalledWith(
      CommonActions.reset({ index: 0, routes: [{ name: "getStarted" }] }),
    )
    expect(navigate).not.toHaveBeenCalled()
  })
})
