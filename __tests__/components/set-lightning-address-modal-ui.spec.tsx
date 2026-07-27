import React from "react"
import { render } from "@testing-library/react-native"

jest.mock("@rn-vui/themed", () => {
  const colors = {
    grey0: "#ccc",
    grey2: "#999",
    grey3: "#aaa",
    grey4: "#eee",
    grey5: "#f5f5f5",
    primary: "#fc5805",
    warning: "#ffaa00",
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

jest.mock("@app/components/atomic/galoy-icon-button", () => ({
  GaloyIconButton: () => null,
}))

jest.mock("@app/components/atomic/galoy-primary-button", () => ({
  GaloyPrimaryButton: ({ title }: { title: string }) =>
    React.createElement("Text", {}, title),
}))

jest.mock("@app/components/atomic/galoy-secondary-button", () => ({
  GaloySecondaryButton: () => null,
}))

jest.mock("@app/components/atomic/galoy-error-box", () => ({
  GaloyErrorBox: ({ errorMessage }: { errorMessage: string }) =>
    React.createElement("Text", { testID: "error-box" }, errorMessage),
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

jest.mock("@app/graphql/generated", () => ({
  useUserUpdateUsernameMutation: () => [jest.fn(), { loading: false }],
  MyUserIdDocument: {},
}))

jest.mock("@app/hooks", () => ({
  useAppConfig: () => ({
    appConfig: { galoyInstance: { name: "Blink", lnAddressHostname: "blink.sv" } },
  }),
  useSaveSessionProfile: () => ({ saveProfile: jest.fn() }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      SetAddressModal: {
        setLightningAddress: () => "Set Lightning address",
        receiveMoney: () => "Receive money with this address.",
        itCannotBeChanged: () => "It cannot be changed later!",
        Errors: {
          tooShort: () => "Address must be at least 3 characters long",
          backupRequired: () => "Back up your wallet before creating a Lightning address",
        },
      },
    },
  }),
}))

import { SetLightningAddressModalUI } from "@app/components/set-lightning-address-modal"
import { SetUsernameError } from "@app/components/set-lightning-address-modal/username-validation"

const baseProps = {
  isVisible: true,
  toggleModal: jest.fn(),
  onSetLightningAddress: jest.fn(),
  loading: false,
  lnAddress: "alice",
  hostname: "blink.sv",
  bankName: "Blink",
}

describe("SetLightningAddressModalUI error messages", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("shows the backup-required message for a BACKUP_REQUIRED error", () => {
    const { getByText } = render(
      <SetLightningAddressModalUI
        {...baseProps}
        error={SetUsernameError.BACKUP_REQUIRED}
      />,
    )

    expect(
      getByText("Back up your wallet before creating a Lightning address"),
    ).toBeTruthy()
  })

  it("shows no error box when there is no error", () => {
    const { queryByTestId } = render(<SetLightningAddressModalUI {...baseProps} />)

    expect(queryByTestId("error-box")).toBeNull()
  })
})
