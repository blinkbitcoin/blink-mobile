import React from "react"
import { Linking } from "react-native"
import { fireEvent, render } from "@testing-library/react-native"

jest.mock("react-native-modal", () => {
  const ReactActual = jest.requireActual("react")
  const RN = jest.requireActual("react-native")
  return ({ isVisible, children }: { isVisible: boolean; children: React.ReactNode }) =>
    isVisible ? ReactActual.createElement(RN.View, null, children) : null
})

jest.mock("@rn-vui/themed", () => {
  const ReactActual = jest.requireActual("react")
  const RN = jest.requireActual("react-native")
  const Content: React.FC<{ children?: React.ReactNode }> = ({ children }) =>
    ReactActual.createElement(RN.View, null, children)
  Content.displayName = "ListItem.Content"
  const Title: React.FC<{ children?: React.ReactNode }> = ({ children }) =>
    ReactActual.createElement(RN.View, null, children)
  Title.displayName = "ListItem.Title"
  const Chevron: React.FC = () => null
  Chevron.displayName = "ListItem.Chevron"
  const ListItem = ({
    onPress,
    children,
  }: {
    onPress: () => void
    children: React.ReactNode
  }) => ReactActual.createElement(RN.TouchableOpacity, { onPress }, children)
  ListItem.displayName = "ListItem"
  ListItem.Content = Content
  ListItem.Title = Title
  ListItem.Chevron = Chevron
  return {
    makeStyles: () => () => ({}),
    useTheme: () => ({
      theme: {
        colors: { black: "#000", white: "#fff", primary: "#fc5805", grey5: "#eee" },
      },
    }),
    Icon: () => null,
    Text: ({ children }: { children: React.ReactNode }) =>
      ReactActual.createElement(RN.Text, null, children),
    ListItem,
  }
})

jest.mock("@app/config", () => ({
  CONTACT_EMAIL_ADDRESS: "support@blink.sv",
  WHATSAPP_CONTACT_NUMBER: "+50365555555",
}))

jest.mock("@app/utils/external", () => ({ openWhatsApp: jest.fn() }))

const mockCopyToClipboard = jest.fn()
jest.mock("@app/hooks/use-clipboard", () => ({
  useClipboard: () => ({ copyToClipboard: mockCopyToClipboard }),
}))

jest.mock("@app/hooks/use-contact-support", () => ({
  useContactSupport: () => ({ supportEmailAddress: "support@blink.sv" }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      support: {
        statusPage: () => "Status page",
        faq: () => "FAQ",
        telegram: () => "Telegram",
        mattermost: () => "Mattermost",
        whatsapp: () => "WhatsApp",
        email: () => "Email",
        emailCopied: ({ email }: { email: string }) =>
          `email ${email} copied to clipboard`,
      },
    },
  }),
}))

import ContactModal, {
  SupportChannels,
} from "@app/components/contact-modal/contact-modal"

const defaultProps = {
  isVisible: true,
  toggleModal: jest.fn(),
  messageBody: "test body",
  messageSubject: "test subject",
}

describe("ContactModal", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(Linking, "openURL").mockResolvedValue(undefined)
  })

  it("shows the support email and copies it on press without navigating", () => {
    const toggleModal = jest.fn()
    const { getByText } = render(
      <ContactModal
        {...defaultProps}
        toggleModal={toggleModal}
        supportChannels={[SupportChannels.EmailCopy]}
      />,
    )

    fireEvent.press(getByText("support@blink.sv"))

    expect(mockCopyToClipboard).toHaveBeenCalledWith({
      content: "support@blink.sv",
      message: "email support@blink.sv copied to clipboard",
    })
    expect(Linking.openURL).not.toHaveBeenCalled()
    expect(toggleModal).toHaveBeenCalled()
  })

  it("keeps the mailto behavior for the Email channel", () => {
    const { getByText } = render(
      <ContactModal {...defaultProps} supportChannels={[SupportChannels.Email]} />,
    )

    fireEvent.press(getByText("Email"))

    expect(Linking.openURL).toHaveBeenCalledWith(
      `mailto:support@blink.sv?subject=${encodeURIComponent(
        "test subject",
      )}&body=${encodeURIComponent("test body")}`,
    )
    expect(mockCopyToClipboard).not.toHaveBeenCalled()
  })
})
