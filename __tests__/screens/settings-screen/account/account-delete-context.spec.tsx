import React, { useEffect, useState } from "react"
import { Text } from "react-native"
import { act, render } from "@testing-library/react-native"

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
}

const controls: Partial<LockControls> = {}

const mountCounter = { mounts: 0, unmounts: 0 }

const LockController: React.FC = () => {
  const { setAccountIsBeingDeleted } = useAccountDeleteContext()
  controls.setAccountIsBeingDeleted = setAccountIsBeingDeleted
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
    mountCounter.mounts = 0
    mountCounter.unmounts = 0
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
})
