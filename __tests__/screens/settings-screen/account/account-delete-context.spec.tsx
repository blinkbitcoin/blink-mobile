import React, { useEffect, useState } from "react"
import { Text } from "react-native"
import { act, render } from "@testing-library/react-native"

import {
  InvisibleBackButton,
  defaultHeaderBack,
} from "@app/components/header-back-control/header-back-control"
import {
  AccountDeleteContextProvider,
  useAccountDeleteContext,
} from "@app/screens/settings-screen/account/account-delete-context"

jest.mock("@rn-vui/themed", () => {
  const colors = { grey2: "#999", white: "#fff" }
  return {
    makeStyles: (fn: (theme: { colors: Record<string, string> }) => object) => () =>
      fn({ colors }),
    Text: ({ children, ...props }: { children: React.ReactNode }) =>
      React.createElement("Text", props, children),
    useTheme: () => ({ theme: { colors } }),
  }
})

const mockSetOptions = jest.fn()
const mockDispatch = jest.fn()
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ setOptions: mockSetOptions, dispatch: mockDispatch }),
  usePreventRemove: (isPrevented: boolean, onPrevented: PreventRemoveCallback) =>
    mockUsePreventRemove(isPrevented, onPrevented),
}))

type PreventRemoveCallback = (options: { data: { action: { type: string } } }) => void
const mockUsePreventRemove = jest.fn<void, [boolean, PreventRemoveCallback]>()

/** What usePreventRemove was last told, and the screen-removal it would refuse. */
const preventRemove = () => {
  const [isPrevented, onPrevented] = mockUsePreventRemove.mock.calls.at(-1) ?? []
  return { isPrevented, onPrevented }
}

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      AccountScreen: {
        accountBeingDeleted: () => "Your account is being closed, please wait...",
      },
    },
  }),
}))

type LockControls = {
  setAccountIsBeingDeleted: (isBeingDeleted: boolean, identifier?: string) => void
  leaveWhileDeleting: (navigate: () => void) => void
}

const controls: Partial<LockControls> = {}

const mountCounter = { mounts: 0, unmounts: 0 }

const LockController: React.FC = () => {
  const { setAccountIsBeingDeleted, leaveWhileDeleting } = useAccountDeleteContext()
  controls.setAccountIsBeingDeleted = setAccountIsBeingDeleted
  controls.leaveWhileDeleting = leaveWhileDeleting
  useEffect(() => {
    mountCounter.mounts += 1
    return () => {
      mountCounter.unmounts += 1
    }
  }, [])
  return <Text>Anon user</Text>
}

describe("AccountDeleteContextProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mountCounter.mounts = 0
    mountCounter.unmounts = 0
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("covers the screen and names the account being removed", () => {
    const { getByTestId, getByText } = render(
      <AccountDeleteContextProvider>
        <LockController />
      </AccountDeleteContextProvider>,
    )

    act(() => controls.setAccountIsBeingDeleted?.(true, "satoshi"))

    expect(getByTestId("account-deletion-lock")).toBeTruthy()
    expect(getByText("satoshi")).toBeTruthy()
    expect(getByText("Your account is being closed, please wait...")).toBeTruthy()
  })

  it("keeps the screen mounted under the cover so the removal it runs is not torn down", () => {
    render(
      <AccountDeleteContextProvider>
        <LockController />
      </AccountDeleteContextProvider>,
    )

    act(() => controls.setAccountIsBeingDeleted?.(true, "satoshi"))

    expect(mountCounter.mounts).toBe(1)
    expect(mountCounter.unmounts).toBe(0)
  })

  it("stays up when the component that raised it leaves the screen mid-removal", () => {
    const Swap: React.FC = () => {
      const [showController, setShowController] = useState(true)
      controlsSwap.hide = () => setShowController(false)
      return showController ? <LockController /> : <Text>Next account</Text>
    }
    const controlsSwap: { hide?: () => void } = {}

    const { getByTestId } = render(
      <AccountDeleteContextProvider>
        <Swap />
      </AccountDeleteContextProvider>,
    )

    act(() => controls.setAccountIsBeingDeleted?.(true, "satoshi"))
    act(() => controlsSwap.hide?.())

    expect(getByTestId("account-deletion-lock")).toBeTruthy()
  })

  it("lifts the cover when released", () => {
    const { queryByTestId } = render(
      <AccountDeleteContextProvider>
        <LockController />
      </AccountDeleteContextProvider>,
    )

    act(() => controls.setAccountIsBeingDeleted?.(true, "satoshi"))
    act(() => controls.setAccountIsBeingDeleted?.(false))

    expect(queryByTestId("account-deletion-lock")).toBeNull()
  })

  /** Without a provider the removal still runs, uncovered and with every exit open, so
   *  a screen that forgot to wrap itself has to be told. */
  it("warns when a removal runs outside a provider", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {})
    render(<LockController />)

    act(() => controls.setAccountIsBeingDeleted?.(true, "satoshi"))

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("outside AccountDeleteContextProvider"),
    )
  })

  it("does not warn inside a provider", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {})
    render(
      <AccountDeleteContextProvider>
        <LockController />
      </AccountDeleteContextProvider>,
    )

    act(() => controls.setAccountIsBeingDeleted?.(true, "satoshi"))
    act(() => controls.leaveWhileDeleting?.(() => {}))

    expect(warn).not.toHaveBeenCalled()
  })

  describe("while the lock is up", () => {
    const renderLocked = () => {
      const view = render(
        <AccountDeleteContextProvider>
          <LockController />
        </AccountDeleteContextProvider>,
      )
      act(() => controls.setAccountIsBeingDeleted?.(true, "satoshi"))
      return view
    }

    /** A headerLeft that renders nothing is not enough: with no left view the platform's
     *  own back arrow appears, and it pops the screen natively onto the next account. */
    it("keeps an inert, invisible control in the header so no back arrow shows", () => {
      renderLocked()

      const [options] = mockSetOptions.mock.calls.at(-1) ?? []
      const headerLeft = options.headerLeft({ canGoBack: true })
      expect(headerLeft).not.toBeNull()
      expect(headerLeft.type).toBe(InvisibleBackButton)
      expect(options.gestureEnabled).toBe(false)
    })

    it("refuses anything else that would remove the screen", () => {
      renderLocked()

      const { isPrevented, onPrevented } = preventRemove()
      expect(isPrevented).toBe(true)
      act(() => onPrevented?.({ data: { action: { type: "POP" } } }))
      expect(mockDispatch).not.toHaveBeenCalled()
    })

    it("lets the removal's own navigation through without lifting the cover", () => {
      const { getByTestId } = renderLocked()
      const action = { type: "NAVIGATE" }

      act(() =>
        controls.leaveWhileDeleting?.(() =>
          preventRemove().onPrevented?.({ data: { action } }),
        ),
      )

      expect(mockDispatch).toHaveBeenCalledWith(action)
      expect(getByTestId("account-deletion-lock")).toBeTruthy()
    })

    it("gives every exit back when released", () => {
      renderLocked()

      act(() => controls.setAccountIsBeingDeleted?.(false))

      expect(mockSetOptions).toHaveBeenLastCalledWith({
        headerLeft: defaultHeaderBack,
        gestureEnabled: true,
      })
      expect(preventRemove().isPrevented).toBe(false)
    })

    /** A lock raised again after a release must not inherit the earlier permission. */
    it("refuses removal again once a new lock is raised after leaving", () => {
      renderLocked()
      act(() => controls.leaveWhileDeleting?.(() => {}))
      act(() => controls.setAccountIsBeingDeleted?.(false))
      act(() => controls.setAccountIsBeingDeleted?.(true, "satoshi"))

      act(() => preventRemove().onPrevented?.({ data: { action: { type: "POP" } } }))

      expect(mockDispatch).not.toHaveBeenCalled()
    })
  })
})
