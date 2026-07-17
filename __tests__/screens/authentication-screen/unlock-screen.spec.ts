import { unlockScreenOptions } from "@app/screens/authentication-screen/unlock-screen"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { RouteProp } from "@react-navigation/native"

/** The module also exports the hook, whose context pulls in native boot code this pure
 *  options function never touches; stubbing it keeps the import graph off the device APIs. */
jest.mock("@app/navigation/navigation-container-wrapper", () => ({
  useAuthenticationContext: jest.fn(),
}))

type UnlockRoute = RouteProp<
  RootStackParamList,
  "authenticationCheck" | "authentication" | "pin"
>

const buildRoute = (params: UnlockRoute["params"]): UnlockRoute =>
  ({ key: "authenticationCheck", name: "authenticationCheck", params }) as UnlockRoute

describe("unlockScreenOptions", () => {
  it("blocks the iOS swipe when the lock was pushed by a resume", () => {
    /** The one guard the automated suite can pin for iOS: the hardware back press the hook
     *  intercepts never fires there, so this gesture is the only thing standing between an
     *  edge swipe and the app behind the resume lock. */
    expect(unlockScreenOptions({ route: buildRoute({ isResume: true }) })).toEqual({
      headerShown: false,
      gestureEnabled: false,
    })
  })

  it("leaves the swipe enabled on a cold start, the only way out of the settings flows", () => {
    expect(unlockScreenOptions({ route: buildRoute({ isResume: false }) })).toEqual({
      headerShown: false,
      gestureEnabled: true,
    })
  })

  it("treats a screen opened without params as a cold start", () => {
    expect(unlockScreenOptions({ route: buildRoute(undefined) })).toEqual({
      headerShown: false,
      gestureEnabled: true,
    })
  })
})
