import React from "react"

import { fireEvent, render } from "@testing-library/react-native"

import { StableSatsModal } from "@app/components/stablesats-modal"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"

const mockLinkingOpenURL = jest.fn()
jest.mock("react-native/Libraries/Linking/Linking", () => ({
  openURL: (...args: unknown[]) => mockLinkingOpenURL(...args),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
}))

jest.mock("@rn-vui/themed", () => {
  const colors = {
    grey0: "#ccc",
    grey1: "#aaa",
    grey2: "#999",
    grey3: "#666",
    grey5: "#f5f5f5",
    primary: "#fc5805",
    black: "#000",
    white: "#fff",
    _white: "#ffffff",
    _green: "#00a700",
    transparent: "transparent",
    error: "#e22d2d",
  }
  const Text = ({
    children,
    onPress,
    style,
  }: {
    children: React.ReactNode
    onPress?: () => void
    style?: unknown
  }) => React.createElement("Text", { onPress, style }, children)
  return {
    makeStyles:
      (fn: (...args: unknown[]) => Record<string, object>) => (props?: unknown) =>
        fn({ colors }, props ?? {}),
    Text,
    useTheme: () => ({ theme: { colors, mode: "light" } }),
  }
})

jest.mock("react-native-modal", () => {
  const ReactNs = jest.requireActual<typeof import("react")>("react")
  const MockModal = ({
    children,
    isVisible,
  }: {
    children: React.ReactNode
    isVisible: boolean
  }) => (isVisible ? ReactNs.createElement("View", { testID: "modal" }, children) : null)
  MockModal.displayName = "MockModal"
  return MockModal
})

jest.mock("react-native-gesture-handler", () => {
  const RN = jest.requireActual<typeof import("react-native")>("react-native")
  return { ScrollView: RN.View, TouchableOpacity: RN.View }
})

jest.mock("@app/i18n/i18n-react", () => {
  const sync = jest.requireActual<typeof import("@app/i18n/i18n-util.sync")>(
    "@app/i18n/i18n-util.sync",
  )
  const util =
    jest.requireActual<typeof import("@app/i18n/i18n-util")>("@app/i18n/i18n-util")
  sync.loadLocale("en")
  const LL = util.i18nObject("en")
  return {
    __esModule: true,
    default: () => null,
    useI18nContext: () => ({ LL, locale: "en" }),
  }
})

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: () => null,
}))

jest.mock("@app/components/atomic/galoy-primary-button", () => ({
  GaloyPrimaryButton: ({ onPress, title }: { onPress: () => void; title: string }) =>
    React.createElement(
      "Pressable",
      { onPress, testID: `primary-${title}` },
      React.createElement("Text", {}, title),
    ),
}))

jest.mock("@app/components/atomic/galoy-secondary-button", () => ({
  GaloySecondaryButton: ({ onPress, title }: { onPress: () => void; title: string }) =>
    React.createElement(
      "Pressable",
      { onPress, testID: `secondary-${title}` },
      React.createElement("Text", {}, title),
    ),
}))

loadLocale("en")
const LL = i18nObject("en")

describe("StableSatsModal", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("does not render when invisible", () => {
    const { queryByTestId } = render(
      <StableSatsModal isVisible={false} setIsVisible={jest.fn()} />,
    )
    expect(queryByTestId("modal")).toBeNull()
  })

  describe("custodial variant (default)", () => {
    it("renders the Stablesats header and body", () => {
      const { getByText } = render(
        <StableSatsModal isVisible={true} setIsVisible={jest.fn()} />,
      )

      expect(getByText(LL.StablesatsModal.header())).toBeTruthy()
      expect(getByText(LL.StablesatsModal.body(), { exact: false })).toBeTruthy()
    })

    it("renders the Stablesats Learn-more label", () => {
      const { getByText } = render(
        <StableSatsModal isVisible={true} setIsVisible={jest.fn()} />,
      )

      expect(getByText(LL.StablesatsModal.learnMore())).toBeTruthy()
    })

    it("opens stablesats.com when Learn more is pressed", () => {
      const { getByText } = render(
        <StableSatsModal isVisible={true} setIsVisible={jest.fn()} />,
      )

      fireEvent.press(getByText(LL.StablesatsModal.learnMore()))
      expect(mockLinkingOpenURL).toHaveBeenCalledWith("https://www.stablesats.com")
    })
  })

  describe("self-custodial variant", () => {
    it("renders the stablecoins header and body", () => {
      const { getByText, queryByText } = render(
        <StableSatsModal
          isVisible={true}
          setIsVisible={jest.fn()}
          variant="selfCustodial"
        />,
      )

      expect(getByText(LL.StablesatsModal.headerSelfCustodial())).toBeTruthy()
      expect(
        getByText(LL.StablesatsModal.bodySelfCustodial(), { exact: false }),
      ).toBeTruthy()
      expect(queryByText(LL.StablesatsModal.header())).toBeNull()
      expect(queryByText(LL.StablesatsModal.body())).toBeNull()
    })

    it("renders the self-custodial Learn-more label", () => {
      const { getByText, queryByText } = render(
        <StableSatsModal
          isVisible={true}
          setIsVisible={jest.fn()}
          variant="selfCustodial"
        />,
      )

      expect(getByText(LL.StablesatsModal.learnMoreSelfCustodial())).toBeTruthy()
      expect(queryByText(LL.StablesatsModal.learnMore())).toBeNull()
    })

    it("opens the dollar-account page when Learn more is pressed", () => {
      const { getByText } = render(
        <StableSatsModal
          isVisible={true}
          setIsVisible={jest.fn()}
          variant="selfCustodial"
        />,
      )

      fireEvent.press(getByText(LL.StablesatsModal.learnMoreSelfCustodial()))
      expect(mockLinkingOpenURL).toHaveBeenCalledWith(
        "https://www.blink.sv/en/dollar-account",
      )
    })

    it("renders the Dollar pill", () => {
      const { getByText } = render(
        <StableSatsModal
          isVisible={true}
          setIsVisible={jest.fn()}
          variant="selfCustodial"
        />,
      )

      expect(getByText(LL.common.dollar())).toBeTruthy()
    })
  })

  describe("shared behaviour", () => {
    it("opens Terms & Conditions on inline link press", () => {
      const { getByText } = render(
        <StableSatsModal isVisible={true} setIsVisible={jest.fn()} />,
      )

      fireEvent.press(getByText(LL.StablesatsModal.termsAndConditions()))
      expect(mockLinkingOpenURL).toHaveBeenCalledWith(
        "https://www.blink.sv/en/terms-conditions",
      )
    })

    it("calls setIsVisible(false) when Back home is pressed", () => {
      const setIsVisible = jest.fn()
      const { getByText } = render(
        <StableSatsModal isVisible={true} setIsVisible={setIsVisible} />,
      )

      fireEvent.press(getByText(LL.common.backHome()))
      expect(setIsVisible).toHaveBeenCalledWith(false)
    })
  })
})
