import React from "react"
import { fireEvent, render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import theme from "@app/rne-theme/theme"
import { NeedHelpSetting } from "@app/screens/settings-screen/settings/community-need-help"

let mockIsAnonMode = false
const mockPromptEnhancedMode = jest.fn()

jest.mock("@app/self-custodial/hooks/use-self-custodial-account-mode", () => ({
  useSelfCustodialAccountMode: () => ({ isAnonMode: mockIsAnonMode }),
}))

jest.mock("@app/components/enhanced-mode-prompt", () => ({
  useEnhancedModePrompt: () => ({ promptEnhancedMode: mockPromptEnhancedMode }),
}))

jest.mock("@app/hooks", () => ({
  useAppConfig: () => ({ appConfig: { galoyInstance: { name: "Blink" } } }),
}))

const mockContactModal = jest.fn()
jest.mock("@app/components/contact-modal/contact-modal", () => ({
  __esModule: true,
  default: (props: { isVisible: boolean }) => {
    mockContactModal(props)
    return null
  },
  SupportChannels: {
    Faq: "faq",
    StatusPage: "statusPage",
    EmailCopy: "emailCopy",
  },
}))

jest.mock("react-native-device-info", () => ({
  getReadableVersion: () => "1.0.0",
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      support: {
        contactUs: () => "Need help? Contact support",
        defaultSupportMessage: () => "message",
        defaultEmailSubject: () => "subject",
      },
    },
  }),
}))

const renderRow = () =>
  render(
    <ThemeProvider theme={theme}>
      <NeedHelpSetting />
    </ThemeProvider>,
  )

describe("NeedHelpSetting", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsAnonMode = false
  })

  it("opens the contact modal on tap", () => {
    const { getByText } = renderRow()

    fireEvent.press(getByText("Need help? Contact support"))

    expect(mockContactModal).toHaveBeenLastCalledWith(
      expect.objectContaining({ isVisible: true }),
    )
    expect(mockPromptEnhancedMode).not.toHaveBeenCalled()
  })

  it("opens the Enhanced prompt instead of the contact modal in Anon mode", () => {
    mockIsAnonMode = true

    const { getByLabelText } = renderRow()

    /** The gated row leaves the accessibility tree; the gate stands in for it. */
    fireEvent.press(getByLabelText("Need help? Contact support"))

    expect(mockPromptEnhancedMode).toHaveBeenCalledTimes(1)
    expect(mockContactModal).toHaveBeenLastCalledWith(
      expect.objectContaining({ isVisible: false }),
    )
  })
})
