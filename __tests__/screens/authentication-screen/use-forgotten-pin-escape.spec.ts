import { Alert, AlertButton } from "react-native"
import { act, renderHook, waitFor } from "@testing-library/react-native"

import { useForgottenPinEscape } from "@app/screens/authentication-screen/use-forgotten-pin-escape"

const mockReadStoredWalletPresence = jest.fn()
const mockRemoveStoredWallets = jest.fn()
const mockRouteAfterLogout = jest.fn()

jest.mock("@app/self-custodial/storage/account-index", () => ({
  StoredWalletPresence: { Present: "present", Absent: "absent", Unknown: "unknown" },
  readStoredWalletPresence: () => mockReadStoredWalletPresence(),
}))

jest.mock("@app/self-custodial/hooks/use-remove-stored-wallets", () => ({
  useRemoveStoredWallets: () => mockRemoveStoredWallets,
}))

jest.mock("@app/hooks/use-logout-and-route", () => ({
  useLogoutAndRoute: () => ({ routeAfterLogout: mockRouteAfterLogout }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      common: { cancel: () => "Cancel" },
      AuthenticationScreen: {
        removeWalletsTitle: () => "Remove wallets from this device?",
        removeWalletsBody: () => "Body",
        removeWalletsConfirm: () => "Remove wallets",
        removeWalletsFailed: () => "Some wallets could not be removed.",
      },
    },
  }),
}))

const renderEscape = async (presence: string) => {
  mockReadStoredWalletPresence.mockResolvedValue(presence)
  const rendered = renderHook(() => useForgottenPinEscape())
  await waitFor(() => expect(rendered.result.current.escape).not.toBeNull())
  return rendered
}

/** Opens the confirmation and hands back its buttons. */
const openConfirmation = (confirmRemoveWallets: () => void) => {
  act(() => confirmRemoveWallets())
  const [title, , buttons] = jest.mocked(Alert.alert).mock.calls[0]
  return { title, buttons: (buttons ?? []) as ReadonlyArray<AlertButton> }
}

const pressRemove = async (buttons: ReadonlyArray<AlertButton>) => {
  const remove = buttons.find((button) => button.text === "Remove wallets")
  await act(async () => {
    await remove?.onPress?.()
  })
}

describe("useForgottenPinEscape", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(Alert, "alert").mockImplementation(() => undefined)
    mockRemoveStoredWallets.mockResolvedValue({
      isEveryWalletRemoved: true,
      isAppLockKept: false,
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("offers nothing until the device has been read", () => {
    /** A read that never answers. */
    mockReadStoredWalletPresence.mockReturnValue(
      new Promise(() => {
        /* never settles */
      }),
    )

    const { result } = renderHook(() => useForgottenPinEscape())

    expect(result.current.escape).toBeNull()
  })

  /** There a logout keeps the lock and comes straight back to it. */
  it("offers removing the wallets on a device that stores one", async () => {
    const { result } = await renderEscape("present")

    expect(result.current.escape).toBe("removeWallets")
  })

  it("offers removing the wallets on a device that cannot tell whether it stores one", async () => {
    const { result } = await renderEscape("unknown")

    expect(result.current.escape).toBe("removeWallets")
  })

  it("offers the logout on a device that stores none, where it takes the lock with it", async () => {
    const { result } = await renderEscape("absent")

    expect(result.current.escape).toBe("logout")
  })

  it("ignores a read that lands after the screen went", async () => {
    let settle: (presence: string) => void = () => undefined
    mockReadStoredWalletPresence.mockReturnValue(
      new Promise((resolve) => {
        settle = resolve
      }),
    )
    const { result, unmount } = renderHook(() => useForgottenPinEscape())

    unmount()
    await act(async () => settle("present"))

    expect(result.current.escape).toBeNull()
  })

  describe("removing the wallets", () => {
    /** A wallet comes back only with its backup phrase, so nothing goes before the owner
     *  says so. */
    it("asks first, and removes nothing when the owner backs out", async () => {
      const { result } = await renderEscape("present")

      const { title, buttons } = openConfirmation(result.current.confirmRemoveWallets)

      expect(title).toBe("Remove wallets from this device?")
      expect(buttons.map((button) => button.text)).toEqual(["Cancel", "Remove wallets"])
      expect(mockRemoveStoredWallets).not.toHaveBeenCalled()
    })

    it("removes them and leaves the way the logout's answer about the lock says", async () => {
      const { result } = await renderEscape("present")

      const { buttons } = openConfirmation(result.current.confirmRemoveWallets)
      await pressRemove(buttons)

      expect(mockRemoveStoredWallets).toHaveBeenCalledTimes(1)
      expect(mockRouteAfterLogout).toHaveBeenCalledWith(false)
    })

    it("says so and stays when not every wallet could be removed", async () => {
      mockRemoveStoredWallets.mockResolvedValue({
        isEveryWalletRemoved: false,
        isAppLockKept: true,
      })
      const { result } = await renderEscape("present")

      const { buttons } = openConfirmation(result.current.confirmRemoveWallets)
      await pressRemove(buttons)

      expect(Alert.alert).toHaveBeenLastCalledWith("Some wallets could not be removed.")
      expect(mockRouteAfterLogout).not.toHaveBeenCalled()
    })

    it("runs one removal at a time", async () => {
      let finish: () => void = () => undefined
      mockRemoveStoredWallets.mockReturnValue(
        new Promise((resolve) => {
          finish = () => resolve({ isEveryWalletRemoved: true, isAppLockKept: false })
        }),
      )
      const { result } = await renderEscape("present")
      const { buttons } = openConfirmation(result.current.confirmRemoveWallets)
      const remove = buttons.find((button) => button.text === "Remove wallets")

      await act(async () => {
        remove?.onPress?.()
        remove?.onPress?.()
        finish()
      })

      expect(mockRemoveStoredWallets).toHaveBeenCalledTimes(1)
    })
  })
})
