import React from "react"
import { render } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"

import { SparkBackupSuccessScreen } from "@app/screens/spark-onboarding/backup-success-screen"
import { ContextForScreen } from "../helper"

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

describe("SparkBackupSuccessScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRouteParams.mockReturnValue(undefined)
  })

  it("renders success message", () => {
    const { getByText } = render(
      <ContextForScreen>
        <SparkBackupSuccessScreen />
      </ContextForScreen>,
    )

    expect(getByText(LL.BackupScreen.ManualBackup.Success.title())).toBeTruthy()
  })

  it("renders generic success copy when reBackup param is true", () => {
    mockRouteParams.mockReturnValue({ reBackup: true })

    const { getByText, queryByText } = render(
      <ContextForScreen>
        <SparkBackupSuccessScreen />
      </ContextForScreen>,
    )

    expect(getByText(LL.common.success())).toBeTruthy()
    expect(queryByText(LL.BackupScreen.ManualBackup.Success.title())).toBeNull()
  })

  it("uses the caller-supplied message when provided, regardless of reBackup", () => {
    mockRouteParams.mockReturnValue({
      reBackup: true,
      message: LL.BackupScreen.ManualBackup.Success.testSuccess(),
    })

    const { getByText, queryByText } = render(
      <ContextForScreen>
        <SparkBackupSuccessScreen />
      </ContextForScreen>,
    )

    expect(getByText(LL.BackupScreen.ManualBackup.Success.testSuccess())).toBeTruthy()
    expect(queryByText(LL.common.success())).toBeNull()
  })

  it("falls back to onboarding copy when neither reBackup nor message are set", () => {
    mockRouteParams.mockReturnValue({})

    const { getByText } = render(
      <ContextForScreen>
        <SparkBackupSuccessScreen />
      </ContextForScreen>,
    )

    expect(getByText(LL.BackupScreen.ManualBackup.Success.title())).toBeTruthy()
  })

  it("renders without crashing", () => {
    const { toJSON } = render(
      <ContextForScreen>
        <SparkBackupSuccessScreen />
      </ContextForScreen>,
    )

    expect(toJSON()).toBeTruthy()
  })

  it("navigates to home after animation completes", async () => {
    render(
      <ContextForScreen>
        <SparkBackupSuccessScreen />
      </ContextForScreen>,
    )

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 50)
    })

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "RESET",
        payload: { index: 0, routes: [{ name: "Primary" }] },
      }),
    )
  })

  it("clears migration checkpoint on navigation", async () => {
    render(
      <ContextForScreen>
        <SparkBackupSuccessScreen />
      </ContextForScreen>,
    )

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 50)
    })

    expect(mockClearCheckpoint).toHaveBeenCalled()
  })
})
