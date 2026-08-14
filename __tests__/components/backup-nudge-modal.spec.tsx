import React from "react"
import { render, fireEvent } from "@testing-library/react-native"

import { BackupNudgeModal } from "@app/components/backup-nudge-modal"

const mockNavigate = jest.fn()

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

jest.mock("@rn-vui/themed", () => {
  const colors = {
    grey0: "#ccc",
    grey2: "#999",
    grey5: "#f5f5f5",
    primary: "#fc5805",
    black: "#000",
    white: "#fff",
  }
  return {
    makeStyles:
      (fn: (...args: unknown[]) => Record<string, object>) => (props?: unknown) =>
        fn({ colors }, props ?? {}),
    Text: ({ children, ...props }: { children: React.ReactNode }) =>
      React.createElement("Text", props, children),
    useTheme: () => ({ theme: { colors, mode: "light" } }),
  }
})

const mockGaloyIcon = jest.fn<null, [Record<string, unknown>]>(() => null)

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: (props: Record<string, unknown>) => {
    mockGaloyIcon(props)
    return null
  },
}))

jest.mock("@app/components/atomic/galoy-icon-button", () => ({
  GaloyIconButton: ({ onPress }: { onPress: () => void }) =>
    React.createElement("Pressable", { onPress, testID: "close-button" }),
}))

jest.mock("@app/components/atomic/galoy-primary-button", () => ({
  GaloyPrimaryButton: ({ onPress, title }: { onPress: () => void; title: string }) =>
    React.createElement(
      "Pressable",
      { onPress, testID: "secure-button" },
      React.createElement("Text", {}, title),
    ),
}))

jest.mock("@app/components/atomic/galoy-secondary-button", () => ({
  GaloySecondaryButton: () => null,
}))

jest.mock("react-native-modal", () => {
  const MockModal = ({
    children,
    isVisible,
  }: {
    children: React.ReactNode
    isVisible: boolean
  }) => (isVisible ? React.createElement("View", { testID: "modal" }, children) : null)
  MockModal.displayName = "MockModal"
  return MockModal
})

jest.mock("@app/utils/testProps", () => ({
  testProps: (id: string) => ({ testID: id }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      BackupNudge: {
        modalTitle: () => "Secure your funds",
        modalDescription: () =>
          "We highly recommend you backup your wallet to prevent a complete loss of funds in case you lose this device.",
        secureMe: () => "Secure wallet",
      },
    },
  }),
}))

describe("BackupNudgeModal", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders when visible", () => {
    const { getByTestId } = render(
      <BackupNudgeModal isVisible={true} onClose={jest.fn()} />,
    )

    expect(getByTestId("modal")).toBeTruthy()
  })

  it("does not render when not visible", () => {
    const { queryByTestId } = render(
      <BackupNudgeModal isVisible={false} onClose={jest.fn()} />,
    )

    expect(queryByTestId("modal")).toBeNull()
  })

  it("renders title and description", () => {
    const { getByText } = render(
      <BackupNudgeModal isVisible={true} onClose={jest.fn()} />,
    )

    expect(getByText("Secure your funds")).toBeTruthy()
    expect(
      getByText(
        "We highly recommend you backup your wallet to prevent a complete loss of funds in case you lose this device.",
      ),
    ).toBeTruthy()
  })

  it("renders secure wallet button", () => {
    const { getByText } = render(
      <BackupNudgeModal isVisible={true} onClose={jest.fn()} />,
    )

    expect(getByText("Secure wallet")).toBeTruthy()
  })

  it("navigates to backup method screen and closes on button press", () => {
    const onClose = jest.fn()
    const { getByTestId } = render(
      <BackupNudgeModal isVisible={true} onClose={onClose} />,
    )

    fireEvent.press(getByTestId("secure-button"))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialBackupMethod")
  })

  it("uses primary color for warning icon", () => {
    render(<BackupNudgeModal isVisible={true} onClose={jest.fn()} />)

    expect(mockGaloyIcon).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "warning",
        size: 52,
        color: "#fc5805",
      }),
    )
  })
})
