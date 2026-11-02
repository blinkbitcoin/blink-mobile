import { CommonActions } from "@react-navigation/native"
import { type NativeStackNavigationProp } from "@react-navigation/native-stack"

import { type RootStackParamList } from "@app/navigation/stack-param-lists"
import { navigateAfterAccountDelete } from "@app/screens/settings-screen/self-custodial/navigate-after-account-delete"

const buildNavigation = () => {
  const dispatch = jest.fn()
  const navigate = jest.fn()
  const routeAfterLogout = jest.fn()
  return {
    navigation: {
      dispatch,
      navigate,
    } as unknown as NativeStackNavigationProp<RootStackParamList>,
    dispatch,
    navigate,
    routeAfterLogout,
  }
}

describe("navigateAfterAccountDelete", () => {
  it("soft-navigates to Primary when the user switched to another self-custodial account", () => {
    const { navigation, dispatch, navigate, routeAfterLogout } = buildNavigation()

    navigateAfterAccountDelete(navigation, routeAfterLogout, "switched-to-self-custodial")

    expect(navigate).toHaveBeenCalledWith("Primary")
    expect(dispatch).not.toHaveBeenCalled()
    expect(routeAfterLogout).not.toHaveBeenCalled()
  })

  it("resets the stack to Primary when the user remained on their current account", () => {
    const { navigation, dispatch, navigate, routeAfterLogout } = buildNavigation()

    navigateAfterAccountDelete(navigation, routeAfterLogout, "remained")

    expect(dispatch).toHaveBeenCalledWith(
      CommonActions.reset({ index: 0, routes: [{ name: "Primary" }] }),
    )
    expect(navigate).not.toHaveBeenCalled()
    expect(routeAfterLogout).not.toHaveBeenCalled()
  })

  it("resets the stack to Primary when the user switched to the custodial account", () => {
    const { navigation, dispatch, navigate, routeAfterLogout } = buildNavigation()

    navigateAfterAccountDelete(navigation, routeAfterLogout, "switched-to-custodial")

    expect(dispatch).toHaveBeenCalledWith(
      CommonActions.reset({ index: 0, routes: [{ name: "Primary" }] }),
    )
    expect(navigate).not.toHaveBeenCalled()
    expect(routeAfterLogout).not.toHaveBeenCalled()
  })

  /** Both ends of the session go through the shared logout route, which owns the lock
   *  flag: one outcome is owed an answer and keeps it raised, the other took the lock with
   *  it and lowers it. Neither is navigated from here. */
  it("hands a session that ended with the lock gone to the logout route", () => {
    const { navigation, dispatch, navigate, routeAfterLogout } = buildNavigation()

    navigateAfterAccountDelete(navigation, routeAfterLogout, "logged-out")

    expect(routeAfterLogout).toHaveBeenCalledWith(false)
    expect(dispatch).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })

  it("hands a session that ended with the lock still standing to the logout route", () => {
    const { navigation, dispatch, navigate, routeAfterLogout } = buildNavigation()

    navigateAfterAccountDelete(navigation, routeAfterLogout, "logged-out-locked")

    expect(routeAfterLogout).toHaveBeenCalledWith(true)
    expect(dispatch).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })
})
