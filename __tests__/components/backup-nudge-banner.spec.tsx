import React from "react"
import { render, fireEvent } from "@testing-library/react-native"

import { BackupNudgeBanner } from "@app/components/backup-nudge-banner"

const mockNavigate = jest.fn()

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

jest.mock("@rn-vui/themed", () => {
  const colors = {
    grey2: "#999",
    grey5: "#f5f5f5",
    primary: "#007",
    black: "#000",
    white: "#fff",
    _orange: "#f90",
  }
  return {
    makeStyles:
      (fn: (theme: { colors: typeof colors }) => Record<string, object>) => () =>
        fn({ colors }),
    Text: ({ children, ...props }: { children: React.ReactNode }) =>
      React.createElement("Text", props, children),
    useTheme: () => ({ theme: { colors } }),
  }
})

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: () => null,
}))

jest.mock("@app/utils/testProps", () => ({
  testProps: (id: string) => ({ testID: id }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      BackupNudge: {
        title: () => "Back up your wallet",
        description: () => "Secure your funds",
        cta: () => "Secure now",
      },
    },
  }),
}))

describe("BackupNudgeBanner", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders title and description", () => {
    const { getByText } = render(<BackupNudgeBanner onDismiss={jest.fn()} />)

    expect(getByText("Back up your wallet")).toBeTruthy()
    expect(getByText("Secure your funds")).toBeTruthy()
  })

  it("calls onDismiss when close button pressed", () => {
    const onDismiss = jest.fn()
    const { getByTestId } = render(<BackupNudgeBanner onDismiss={onDismiss} />)

    fireEvent.press(getByTestId("backup-nudge-dismiss"))

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it("navigates to backup method screen on CTA press", () => {
    const { getByTestId } = render(<BackupNudgeBanner onDismiss={jest.fn()} />)

    fireEvent.press(getByTestId("backup-nudge-cta"))

    expect(mockNavigate).toHaveBeenCalledWith("sparkBackupMethodScreen")
  })
})
