import React from "react"
import { Alert, Linking } from "react-native"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { CardSettingsScreen } from "@app/screens/card-screen/card-settings-screen"
import { ContextForScreen } from "../../helper"

jest.mock("react-native-reanimated", () => {
  const RNView = jest.requireActual<typeof import("react-native")>("react-native").View
  return {
    __esModule: true,
    default: {
      View: RNView,
      createAnimatedComponent: (component: React.ComponentType) => component,
    },
    useSharedValue: (initial: number) => ({ value: initial }),
    useAnimatedStyle: () => ({}),
    withTiming: (value: number) => value,
    interpolateColor: () => "transparent",
  }
})

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => ({
    feedbackEmailAddress: "support@blink.sv",
    cardTermsAndConditionsUrl: "https://www.blink.sv/en/terms-conditions",
    cardPrivacyPolicyUrl: "https://www.blink.sv/en/privacy-policy",
  }),
}))

jest.mock("@app/utils/helper", () => ({
  isIos: false,
}))

jest.mock("react-native/Libraries/Linking/Linking", () => ({
  openURL: jest.fn(),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  getInitialURL: jest.fn(() => Promise.resolve(null)),
}))

const mockInAppBrowserOpen = jest.fn()
jest.mock("react-native-inappbrowser-reborn", () => ({
  __esModule: true,
  default: { open: (...args: readonly unknown[]) => mockInAppBrowserOpen(...args) },
}))

const mockToggleCategory = jest.fn()
const mockIsCategoryEnabled = jest.fn((category: string) => category === "Payments")
const mockCloseCard = jest.fn()
let mockCloseCardAccountReturn = {
  closeCard: mockCloseCard,
  loading: false,
  hasPendingTransactions: false,
  hasPositiveBalance: false,
  balanceDisplay: "",
}
jest.mock("@app/screens/card-screen/card-settings-screen/hooks", () => ({
  NotificationCategory: {
    Payments: "Payments",
    Marketing: "Marketing",
  },
  useNotificationToggle: () => ({
    isCategoryEnabled: mockIsCategoryEnabled,
    toggleCategory: mockToggleCategory,
  }),
  useCloseCardAccount: () => mockCloseCardAccountReturn,
}))

const mockNavigate = jest.fn()
jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native")
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: mockNavigate,
    }),
  }
})

describe("CardSettingsScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    mockNavigate.mockClear()
    mockCloseCardAccountReturn = {
      closeCard: mockCloseCard,
      loading: false,
      hasPendingTransactions: false,
      hasPositiveBalance: false,
      balanceDisplay: "",
    }
  })

  describe("rendering", () => {
    it("renders without crashing", async () => {
      const { toJSON } = render(
        <ContextForScreen>
          <CardSettingsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(toJSON()).toBeTruthy()
    })

    it("displays account information section title", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardSettingsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Account Information")).toBeTruthy()
    })

    it("displays personal details row", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardSettingsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Personal Details")).toBeTruthy()
    })

    it("displays change pin row", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardSettingsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Change PIN")).toBeTruthy()
    })
  })

  describe("notifications section", () => {
    it("displays notifications section title", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardSettingsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Notifications")).toBeTruthy()
    })

    it("displays transaction alerts switch", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardSettingsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Transaction alerts")).toBeTruthy()
      expect(getByText("Get notified for all transactions")).toBeTruthy()
    })

    it("displays marketing updates switch", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardSettingsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Marketing updates")).toBeTruthy()
      expect(getByText("Product updates and offers")).toBeTruthy()
    })
  })

  describe("card management section", () => {
    it("displays card management section title", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardSettingsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Card management")).toBeTruthy()
    })

    it("displays order physical card row", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardSettingsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Order physical card")).toBeTruthy()
    })

    it("displays add to google pay row", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardSettingsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Add to Google Pay")).toBeTruthy()
    })

    it("displays replace card row", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardSettingsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Replace card")).toBeTruthy()
    })
  })

  describe("support section", () => {
    it("displays support section title", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardSettingsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Support")).toBeTruthy()
    })

    it("displays contact support row with email", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardSettingsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Contact Support")).toBeTruthy()
      expect(getByText("support@blink.sv")).toBeTruthy()
    })
  })

  describe("account section", () => {
    it("displays account section title", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardSettingsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Account")).toBeTruthy()
    })

    it("displays terms and conditions row", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardSettingsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Card Terms & Conditions")).toBeTruthy()
    })

    it("displays privacy policy row", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardSettingsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Card Privacy Policy")).toBeTruthy()
    })
  })

  describe("danger zone section", () => {
    it("displays danger zone section title", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardSettingsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Danger zone")).toBeTruthy()
    })

    it("displays close card account row", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardSettingsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Close card account")).toBeTruthy()
      expect(getByText("Permanently close your Visa card")).toBeTruthy()
    })
  })

  describe("interactions", () => {
    it("allows pressing personal details row and navigates", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardSettingsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const row = getByText("Personal Details")
      await act(async () => {
        fireEvent.press(row)
      })

      expect(mockNavigate).toHaveBeenCalledWith("cardPersonalDetailsScreen")
    })

    it("allows pressing change pin row and navigates", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardSettingsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const row = getByText("Change PIN")
      await act(async () => {
        fireEvent.press(row)
      })

      expect(mockNavigate).toHaveBeenCalledWith("cardChangePinScreen")
    })

    it("allows pressing order physical card row", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardSettingsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const row = getByText("Order physical card")
      await act(async () => {
        fireEvent.press(row)
      })

      expect(mockNavigate).toHaveBeenCalledWith("orderCardScreen")
    })

    it("allows pressing add to mobile wallet row and navigates", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardSettingsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const row = getByText("Add to Google Pay")
      await act(async () => {
        fireEvent.press(row)
      })

      expect(mockNavigate).toHaveBeenCalledWith("cardAddToMobileWalletScreen")
    })

    it("allows pressing replace card row", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardSettingsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const row = getByText("Replace card")
      await act(async () => {
        fireEvent.press(row)
      })

      expect(mockNavigate).toHaveBeenCalledWith("replaceCardScreen")
    })

    it("allows pressing contact support row and opens mailto", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardSettingsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const row = getByText("Contact Support")
      await act(async () => {
        fireEvent.press(row)
      })

      expect(Linking.openURL).toHaveBeenCalledWith("mailto:support@blink.sv")
    })

    it("opens terms and conditions URL in InAppBrowser", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardSettingsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const row = getByText("Card Terms & Conditions")
      await act(async () => {
        fireEvent.press(row)
      })

      expect(mockInAppBrowserOpen).toHaveBeenCalledWith(
        "https://www.blink.sv/en/terms-conditions",
      )
    })

    it("opens privacy policy URL in InAppBrowser", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardSettingsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const row = getByText("Card Privacy Policy")
      await act(async () => {
        fireEvent.press(row)
      })

      expect(mockInAppBrowserOpen).toHaveBeenCalledWith(
        "https://www.blink.sv/en/privacy-policy",
      )
    })

    it("opens close modal directly when no blockers", async () => {
      const alertSpy = jest.spyOn(Alert, "alert")

      const { getByText } = render(
        <ContextForScreen>
          <CardSettingsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      await act(async () => {
        fireEvent.press(getByText("Close card account"))
      })

      expect(alertSpy).not.toHaveBeenCalled()
      expect(
        getByText(
          "This action is permanent. Your Visa card will be canceled and cannot be reactivated.",
        ),
      ).toBeTruthy()

      alertSpy.mockRestore()
    })

    it("shows alert when there are pending transactions", async () => {
      mockCloseCardAccountReturn = {
        ...mockCloseCardAccountReturn,
        hasPendingTransactions: true,
      }
      const alertSpy = jest.spyOn(Alert, "alert")

      const { getByText } = render(
        <ContextForScreen>
          <CardSettingsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      await act(async () => {
        fireEvent.press(getByText("Close card account"))
      })

      expect(alertSpy).toHaveBeenCalledWith(
        "Warning",
        "You have pending transactions. Please wait until they are settled before closing your card.",
      )

      alertSpy.mockRestore()
    })

    it("shows balance warning alert when has positive balance", async () => {
      mockCloseCardAccountReturn = {
        ...mockCloseCardAccountReturn,
        hasPositiveBalance: true,
        balanceDisplay: "~$15.00",
      }
      const alertSpy = jest.spyOn(Alert, "alert")

      const { getByText } = render(
        <ContextForScreen>
          <CardSettingsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      await act(async () => {
        fireEvent.press(getByText("Close card account"))
      })

      expect(alertSpy).toHaveBeenCalledWith(
        "Warning",
        expect.stringContaining("~$15.00"),
        expect.any(Array),
      )

      alertSpy.mockRestore()
    })
  })

  describe("switch interactions", () => {
    it("calls toggleCategory with Payments when transaction alerts switch is pressed", async () => {
      const { getAllByRole } = render(
        <ContextForScreen>
          <CardSettingsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const switches = getAllByRole("switch")
      expect(switches[0].props.accessibilityState.checked).toBe(true)

      await act(async () => {
        fireEvent(switches[0], "pressIn")
      })

      expect(mockToggleCategory).toHaveBeenCalledWith("Payments", false)
    })

    it("calls toggleCategory with Marketing when marketing updates switch is pressed", async () => {
      const { getAllByRole } = render(
        <ContextForScreen>
          <CardSettingsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const switches = getAllByRole("switch")
      expect(switches[1].props.accessibilityState.checked).toBe(false)

      await act(async () => {
        fireEvent(switches[1], "pressIn")
      })

      expect(mockToggleCategory).toHaveBeenCalledWith("Marketing", true)
    })
  })

  describe("complete user flow", () => {
    it("displays all screen sections", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardSettingsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Account Information")).toBeTruthy()
      expect(getByText("Notifications")).toBeTruthy()
      expect(getByText("Card management")).toBeTruthy()
      expect(getByText("Support")).toBeTruthy()
      expect(getByText("Account")).toBeTruthy()
      expect(getByText("Danger zone")).toBeTruthy()
    })

    it("user can navigate through all settings", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardSettingsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      await act(async () => {
        fireEvent.press(getByText("Personal Details"))
      })

      await act(async () => {
        fireEvent.press(getByText("Order physical card"))
      })

      await act(async () => {
        fireEvent.press(getByText("Contact Support"))
      })

      expect(mockNavigate).toHaveBeenCalledWith("cardPersonalDetailsScreen")
      expect(mockNavigate).toHaveBeenCalledWith("orderCardScreen")
      expect(Linking.openURL).toHaveBeenCalledWith("mailto:support@blink.sv")
    })
  })
})
