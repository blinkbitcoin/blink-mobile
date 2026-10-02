import { BackHandler } from "react-native"
import { act, renderHook } from "@testing-library/react-native"

import {
  unlockScreenOptions,
  useUnlockScreen,
} from "@app/screens/authentication-screen/unlock-screen"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { RouteProp } from "@react-navigation/native"

const mockGoBack = jest.fn()
const mockSetAppUnlocked = jest.fn()
const mockListSelfCustodialAccounts = jest.fn()

/** One object across renders, as the real navigation prop is. */
const mockNavigation = { goBack: mockGoBack }

jest.mock("@react-navigation/native", () => {
  const { useEffect } = jest.requireActual("react")
  return {
    ...jest.requireActual("@react-navigation/native"),
    useNavigation: () => mockNavigation,
    /** The hook is rendered on its own, with no navigator around it to focus, so being
     *  mounted is what stands in for being focused. */
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
  }
})

/** The hook's context pulls in native boot code neither it nor the pure options function
 *  touches; stubbing it keeps the import graph off the device APIs. */
jest.mock("@app/navigation/navigation-container-wrapper", () => ({
  useAuthenticationContext: () => ({ setAppUnlocked: mockSetAppUnlocked }),
}))

let mockIsAuthed = false
let mockActiveAccountId: string | undefined

jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => mockIsAuthed,
}))

jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({
    persistentState: { activeAccountId: mockActiveAccountId },
  }),
}))

/** The index module reaches the keystore, which is native; only its read and the statuses
 *  that read answers with are stood in for. */
jest.mock("@app/self-custodial/storage/account-index", () => ({
  StorageReadStatus: { Ok: "ok", ReadFailed: "read-failed" },
  listSelfCustodialAccounts: () => mockListSelfCustodialAccounts(),
}))

/**
 * What the device has to show once its lock is answered. A session and a chosen account
 * are known at once; with neither, the wallets the device stores are read.
 */
const deviceHolds = ({
  session = false,
  chosenAccountId,
  storedWalletIds = [],
}: {
  session?: boolean
  chosenAccountId?: string
  storedWalletIds?: ReadonlyArray<string>
}) => {
  mockIsAuthed = session
  mockActiveAccountId = chosenAccountId
  mockListSelfCustodialAccounts.mockResolvedValue({
    status: "ok",
    entries: storedWalletIds.map((id) => ({ id, lightningAddress: null })),
  })
}

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

describe("useUnlockScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    deviceHolds({ session: true })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  /** Completes the unlock the way an unlock screen does, lets what it reads settle, and
   *  hands back where it was told to land. */
  const completeColdStart = async (isResume = false) => {
    const navigateOnColdStart = jest.fn()
    const rendered = renderHook(() => useUnlockScreen({ isResume }))
    await act(async () => {
      rendered.result.current.completeUnlock(navigateOnColdStart)
    })
    return { navigateOnColdStart, ...rendered }
  }

  describe("where a cold start lands", () => {
    /** Every launch starts at the gate, so the unlock screens decide where one ends up:
     *  the home screen for a device with an account to show, the landing screen for one
     *  without. */
    it("opens the home screen for a device with a session, without reading what it stores", async () => {
      const { navigateOnColdStart } = await completeColdStart()

      expect(navigateOnColdStart).toHaveBeenCalledTimes(1)
      expect(navigateOnColdStart).toHaveBeenCalledWith("Primary")
      expect(mockListSelfCustodialAccounts).not.toHaveBeenCalled()
    })

    it("opens the home screen for a chosen account, even one the device no longer indexes", async () => {
      /** A pointer to an account the device no longer indexes is tolerated everywhere
       *  else, and it opened the home screen when the navigator asked this itself. */
      deviceHolds({ chosenAccountId: "orphaned-account-id" })

      const { navigateOnColdStart } = await completeColdStart()

      expect(navigateOnColdStart).toHaveBeenCalledWith("Primary")
      expect(mockListSelfCustodialAccounts).not.toHaveBeenCalled()
    })

    it("opens the home screen for a wallet stored with no session and no chosen account", async () => {
      /** What a logout leaves behind on a device that stores a wallet: the account its
       *  owner expects to find behind the lock they just answered. */
      deviceHolds({ storedWalletIds: ["stored-wallet-id"] })

      const { navigateOnColdStart } = await completeColdStart()

      expect(navigateOnColdStart).toHaveBeenCalledTimes(1)
      expect(navigateOnColdStart).toHaveBeenCalledWith("Primary")
    })

    it("opens the landing screen for a device with nothing to show", async () => {
      deviceHolds({})

      const { navigateOnColdStart } = await completeColdStart()

      expect(navigateOnColdStart).toHaveBeenCalledTimes(1)
      expect(navigateOnColdStart).toHaveBeenCalledWith("getStarted")
    })

    it("opens the landing screen when what the device stores cannot be read", async () => {
      /** Where a launch with no session always started before the gate was in front of
       *  it. The wallet, if there is one, is still behind the account switcher. */
      deviceHolds({})
      mockListSelfCustodialAccounts.mockResolvedValue({
        status: "read-failed",
        error: new Error("AsyncStorage unavailable"),
      })

      const { navigateOnColdStart } = await completeColdStart()

      expect(navigateOnColdStart).toHaveBeenCalledWith("getStarted")
    })
  })

  describe("while what the device stores is being read", () => {
    /** Holds the read open and hands back what settles it. */
    const holdStoredWalletRead = () => {
      let settle: (ids: ReadonlyArray<string>) => void = () => {}
      mockListSelfCustodialAccounts.mockReturnValue(
        new Promise((resolve) => {
          settle = (ids) =>
            resolve({
              status: "ok",
              entries: ids.map((id) => ({ id, lightningAddress: null })),
            })
        }),
      )
      return (ids: ReadonlyArray<string>) => act(async () => settle(ids))
    }

    it("lowers the lock at once but holds the landing", async () => {
      deviceHolds({})
      const settleRead = holdStoredWalletRead()

      const { navigateOnColdStart } = await completeColdStart()

      expect(mockSetAppUnlocked).toHaveBeenCalledTimes(1)
      expect(navigateOnColdStart).not.toHaveBeenCalled()

      await settleRead(["stored-wallet-id"])

      expect(navigateOnColdStart).toHaveBeenCalledTimes(1)
      expect(navigateOnColdStart).toHaveBeenCalledWith("Primary")
    })

    it("does not route a screen that is gone by the time the read answers", async () => {
      /** Something else took the screen away meanwhile, and routing from it would move
       *  whatever replaced it. */
      deviceHolds({})
      const settleRead = holdStoredWalletRead()
      const { navigateOnColdStart, unmount } = await completeColdStart()

      unmount()
      await settleRead([])

      expect(navigateOnColdStart).not.toHaveBeenCalled()
    })

    it("opens the home screen when a session turned up while the read was out", async () => {
      /** What the read answers with is where a device with no session lands, and by the
       *  time it answers this device has one. */
      deviceHolds({})
      const settleRead = holdStoredWalletRead()
      const { navigateOnColdStart, rerender } = await completeColdStart()

      mockIsAuthed = true
      rerender({})
      await settleRead([])

      expect(navigateOnColdStart).toHaveBeenCalledTimes(1)
      expect(navigateOnColdStart).toHaveBeenCalledWith("Primary")
    })

    it("ignores an unlock completed again before the read answers", async () => {
      deviceHolds({})
      const settleRead = holdStoredWalletRead()
      const { navigateOnColdStart, result } = await completeColdStart()
      const laterNavigate = jest.fn()

      act(() => result.current.completeUnlock(laterNavigate))
      await settleRead([])

      expect(navigateOnColdStart).toHaveBeenCalledTimes(1)
      expect(laterNavigate).not.toHaveBeenCalled()
      expect(mockListSelfCustodialAccounts).toHaveBeenCalledTimes(1)
    })
  })

  describe("completing the unlock", () => {
    it("lowers the lock and routes forward on a cold start", async () => {
      const { navigateOnColdStart } = await completeColdStart()

      expect(mockSetAppUnlocked).toHaveBeenCalledTimes(1)
      expect(navigateOnColdStart).toHaveBeenCalledTimes(1)
      expect(mockGoBack).not.toHaveBeenCalled()
    })

    it("lowers the lock and steps back on a resume, routing nowhere", async () => {
      /** A resume has a screen to step back to whatever the device stores. */
      deviceHolds({})

      const { navigateOnColdStart } = await completeColdStart(true)

      expect(mockSetAppUnlocked).toHaveBeenCalledTimes(1)
      expect(mockGoBack).toHaveBeenCalledTimes(1)
      expect(navigateOnColdStart).not.toHaveBeenCalled()
      expect(mockListSelfCustodialAccounts).not.toHaveBeenCalled()
    })

    describe("more than once", () => {
      /** One unlock, one way out: the screen is gone once it has left, and leaving again
       *  would be routing from a screen that no longer exists. */
      it("routes forward only the first time", async () => {
        const { navigateOnColdStart, result } = await completeColdStart()

        act(() => result.current.completeUnlock(navigateOnColdStart))

        expect(navigateOnColdStart).toHaveBeenCalledTimes(1)
        expect(mockSetAppUnlocked).toHaveBeenCalledTimes(1)
      })

      it("steps back only the first time on a resume", async () => {
        const { navigateOnColdStart, result } = await completeColdStart(true)

        act(() => result.current.completeUnlock(navigateOnColdStart))

        expect(mockGoBack).toHaveBeenCalledTimes(1)
      })
    })

    it("lands where the device stands when the unlock completes, not when its handler was made", async () => {
      /** The biometric prompt is handed a success handler from the screen's first render,
       *  and what the device holds can change between that render and the prompt being
       *  passed. */
      deviceHolds({})
      const navigateOnColdStart = jest.fn()
      const { result, rerender } = renderHook(() => useUnlockScreen({ isResume: false }))
      const completeUnlockFromFirstRender = result.current.completeUnlock

      deviceHolds({ session: true })
      rerender({})
      await act(async () => {
        completeUnlockFromFirstRender(navigateOnColdStart)
      })

      expect(navigateOnColdStart).toHaveBeenCalledWith("Primary")
      expect(mockListSelfCustodialAccounts).not.toHaveBeenCalled()
    })
  })

  describe("the hardware back press", () => {
    it("is swallowed while a resume lock is up", () => {
      const addListener = jest.spyOn(BackHandler, "addEventListener")

      renderHook(() => useUnlockScreen({ isResume: true }))

      const [eventName, onBackPress] = addListener.mock.calls[0]
      expect(eventName).toBe("hardwareBackPress")
      expect(onBackPress()).toBe(true)
    })

    it("is left alone on a cold start, which has nothing behind it", () => {
      const addListener = jest.spyOn(BackHandler, "addEventListener")

      renderHook(() => useUnlockScreen({ isResume: false }))

      expect(addListener).not.toHaveBeenCalled()
    })

    it("stops being swallowed once the lock screen is gone", () => {
      const remove = jest.fn()
      jest.spyOn(BackHandler, "addEventListener").mockReturnValue({ remove })

      const { unmount } = renderHook(() => useUnlockScreen({ isResume: true }))
      unmount()

      expect(remove).toHaveBeenCalledTimes(1)
    })
  })
})
