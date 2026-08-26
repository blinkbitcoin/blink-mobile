import React, { useLayoutEffect } from "react"
import { Text } from "react-native"
import { act, fireEvent, render } from "@testing-library/react-native"

import { ScreenSecurityGate } from "@app/components/screen-security-gate"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import type { ScreenSecurityLease } from "@app/utils/screen-security"

import { ContextForScreen } from "../screens/helper"

const mockAcquireScreenSecurity = jest.fn<ScreenSecurityLease, []>()
jest.mock("@app/utils/screen-security", () => ({
  acquireScreenSecurity: () => mockAcquireScreenSecurity(),
}))

const mockSetOptions = jest.fn()
const mockGoBack = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ setOptions: mockSetOptions, goBack: mockGoBack }),
}))

const deferred = <T,>() => {
  let resolve: (value: T) => void = () => {}
  let reject: (reason: Error) => void = () => {}
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** A lease whose registration settles under the test's control. */
const pendingLease = () => {
  const registration = deferred<void>()
  const lease: ScreenSecurityLease & {
    resolve: () => void
    reject: (error: Error) => void
  } = {
    ready: registration.promise,
    release: jest.fn(() => Promise.resolve()),
    resolve: () => registration.resolve(undefined),
    reject: (error: Error) => registration.reject(error),
  }
  mockAcquireScreenSecurity.mockReturnValue(lease)
  return lease
}

const SENSITIVE = "seed words go here"

const SensitiveContent = () => <Text>{SENSITIVE}</Text>

/** Stands in for the screens' own header effects: a Copy/Paste action installed
 *  from the sensitive subtree must not be installed while the subtree is gated. */
const SensitiveContentWithHeaderAction = () => {
  useLayoutEffect(() => {
    mockSetOptions({ headerRight: () => <Text>Copy</Text> })
  }, [])
  return <Text>{SENSITIVE}</Text>
}

const renderGated = (
  children: React.ReactNode = <SensitiveContent />,
  props: { onBack?: () => void; failOpen?: boolean } = {},
) =>
  render(
    <ContextForScreen>
      <ScreenSecurityGate {...props}>{children}</ScreenSecurityGate>
    </ContextForScreen>,
  )

describe("ScreenSecurityGate", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
  })

  it("renders a spinner — not the sensitive content — while activating", async () => {
    pendingLease()

    const { queryByText, getByTestId, queryByTestId } = renderGated()
    await act(async () => {})

    expect(queryByText(SENSITIVE)).toBeNull()
    expect(getByTestId("screen-security-activating")).toBeTruthy()
    expect(queryByTestId("screen-security-retry")).toBeNull()
  })

  it("mounts the sensitive content once the guard is active", async () => {
    const lease = pendingLease()

    const { queryByText, getByText } = renderGated()
    expect(queryByText(SENSITIVE)).toBeNull()

    lease.resolve()
    await act(async () => {})

    expect(getByText(SENSITIVE)).toBeTruthy()
  })

  it("keeps the content unmounted after failure and offers retry and back", async () => {
    const lease = pendingLease()

    const { queryByText, getByTestId } = renderGated()
    await act(async () => {})
    lease.reject(new Error("native failure"))
    await act(async () => {})

    expect(queryByText(SENSITIVE)).toBeNull()
    expect(getByTestId("screen-security-retry")).toBeTruthy()

    fireEvent.press(getByTestId("screen-security-back"))
    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })

  it("releases the failed lease and acquires a fresh one when retry is pressed", async () => {
    const failedLease = pendingLease()

    const { queryByText, getByTestId } = renderGated()
    await act(async () => {})
    failedLease.reject(new Error("native failure"))
    await act(async () => {})

    const freshLease = pendingLease()
    fireEvent.press(getByTestId("screen-security-retry"))
    await act(async () => {})

    // The key remount tears the old hook subtree down: its lease is released
    // exactly once and a new registration starts before anything renders.
    expect(failedLease.release).toHaveBeenCalledTimes(1)
    expect(mockAcquireScreenSecurity).toHaveBeenCalledTimes(2)
    expect(queryByText(SENSITIVE)).toBeNull()

    freshLease.resolve()
    await act(async () => {})
    expect(queryByText(SENSITIVE)).toBeTruthy()
  })

  it("routes the failure-view Back through the screen's own handler when provided", async () => {
    const lease = pendingLease()
    const onBack = jest.fn()

    const { getByTestId } = renderGated(<SensitiveContent />, { onBack })
    await act(async () => {})
    lease.reject(new Error("native failure"))
    await act(async () => {})

    fireEvent.press(getByTestId("screen-security-back"))

    expect(onBack).toHaveBeenCalledTimes(1)
    expect(mockGoBack).not.toHaveBeenCalled()
  })

  it("fails open and mounts the content when the screen opts in", async () => {
    const lease = pendingLease()

    const { queryByText, getByText, queryByTestId } = renderGated(<SensitiveContent />, {
      failOpen: true,
    })
    await act(async () => {})

    // Still gated while registration is pending — only the terminal failure opens.
    expect(queryByText(SENSITIVE)).toBeNull()

    lease.reject(new Error("native failure"))
    await act(async () => {})

    expect(getByText(SENSITIVE)).toBeTruthy()
    expect(queryByTestId("screen-security-retry")).toBeNull()
  })

  it("does not install header actions from the sensitive subtree while gated", async () => {
    const lease = pendingLease()
    const gated = renderGated(<SensitiveContentWithHeaderAction />)
    await act(async () => {})

    expect(mockSetOptions).not.toHaveBeenCalled()

    lease.resolve()
    gated.rerender(
      <ContextForScreen>
        <ScreenSecurityGate>
          <SensitiveContentWithHeaderAction />
        </ScreenSecurityGate>
      </ContextForScreen>,
    )
    await act(async () => {})

    expect(mockSetOptions).toHaveBeenCalled()
  })
})
