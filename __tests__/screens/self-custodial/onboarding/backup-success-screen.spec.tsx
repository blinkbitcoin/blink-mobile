import React from "react"
import { render, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"

import { BackupSuccessScreen } from "@app/screens/self-custodial/onboarding/backup-success-screen"
import { ContextForScreen } from "../../helper"
import { flushEffects } from "../../../helpers/flush-effects"

jest.mock("@app/components/success-animation/success-icon-animation", () => {
  const { View } = jest.requireActual("react-native")
  return {
    SuccessIconAnimation: ({ children }: { children: React.ReactNode }) => (
      <View>{children}</View>
    ),
  }
})

jest.mock("@app/components/success-animation/success-text-animation", () => {
  const { View } = jest.requireActual("react-native")
  return {
    CompletedTextAnimation: ({
      children,
      onComplete,
    }: {
      children: React.ReactNode
      onComplete?: () => void
    }) => {
      if (onComplete) setTimeout(onComplete, 0)
      return <View>{children}</View>
    },
  }
})

const mockClearCheckpoint = jest.fn()
jest.mock("@app/screens/account-migration/hooks", () => ({
  useMigrationCheckpoint: () => ({
    clearCheckpoint: mockClearCheckpoint,
  }),
}))

const mockDispatch = jest.fn()
const mockRouteParams = jest.fn<
  { reBackup?: boolean; message?: string } | undefined,
  []
>()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ dispatch: mockDispatch }),
  useRoute: () => ({ params: mockRouteParams() }),
  CommonActions: {
    reset: (config: { index: number; routes: Array<{ name: string }> }) => ({
      type: "RESET",
      payload: config,
    }),
  },
}))

loadLocale("en")
const LL = i18nObject("en")

describe("BackupSuccessScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRouteParams.mockReturnValue(undefined)
  })

  it("renders success message", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <BackupSuccessScreen />
      </ContextForScreen>,
    )

    expect(getByText(LL.BackupScreen.ManualBackup.Success.title())).toBeTruthy()
    await flushEffects()
  })

  it("renders generic success copy when reBackup param is true", async () => {
    mockRouteParams.mockReturnValue({ reBackup: true })

    const { getByText, queryByText } = render(
      <ContextForScreen>
        <BackupSuccessScreen />
      </ContextForScreen>,
    )

    expect(getByText(LL.common.success())).toBeTruthy()
    expect(queryByText(LL.BackupScreen.ManualBackup.Success.title())).toBeNull()
    await flushEffects()
  })

  it("uses the caller-supplied message when provided, regardless of reBackup", async () => {
    mockRouteParams.mockReturnValue({
      reBackup: true,
      message: LL.BackupScreen.ManualBackup.Success.testSuccess(),
    })

    const { getByText, queryByText } = render(
      <ContextForScreen>
        <BackupSuccessScreen />
      </ContextForScreen>,
    )

    expect(getByText(LL.BackupScreen.ManualBackup.Success.testSuccess())).toBeTruthy()
    expect(queryByText(LL.common.success())).toBeNull()
    await flushEffects()
  })

  it("falls back to onboarding copy when neither reBackup nor message are set", async () => {
    mockRouteParams.mockReturnValue({})

    const { getByText } = render(
      <ContextForScreen>
        <BackupSuccessScreen />
      </ContextForScreen>,
    )

    expect(getByText(LL.BackupScreen.ManualBackup.Success.title())).toBeTruthy()
    await flushEffects()
  })

  it("renders without crashing", async () => {
    const { toJSON } = render(
      <ContextForScreen>
        <BackupSuccessScreen />
      </ContextForScreen>,
    )

    expect(toJSON()).toBeTruthy()
    await flushEffects()
  })

  it("holds the screen after the animation and then navigates home", async () => {
    jest.useFakeTimers({ doNotFake: ["setImmediate"] })
    render(
      <ContextForScreen>
        <BackupSuccessScreen />
      </ContextForScreen>,
    )

    act(() => {
      jest.advanceTimersByTime(0)
    })
    expect(mockDispatch).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(2000)
    })
    jest.useRealTimers()

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "RESET",
        payload: { index: 0, routes: [{ name: "Primary" }] },
      }),
    )
  })

  it("leaves any pending migration checkpoint untouched", async () => {
    jest.useFakeTimers({ doNotFake: ["setImmediate"] })
    render(
      <ContextForScreen>
        <BackupSuccessScreen />
      </ContextForScreen>,
    )

    act(() => {
      jest.advanceTimersByTime(2000)
    })
    jest.useRealTimers()

    expect(mockClearCheckpoint).not.toHaveBeenCalled()
  })
})
