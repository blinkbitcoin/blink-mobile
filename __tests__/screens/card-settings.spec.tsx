import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { CardSettingsScreen } from "@app/screens/card-screen/card-settings-screen"
import { ContextForScreen } from "./helper"

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
  }),
}))

jest.mock("@app/utils/helper", () => ({
  isIos: false,
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

    it("displays security alerts switch", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardSettingsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Security alerts")).toBeTruthy()
      expect(getByText("Get notified for security-related activities")).toBeTruthy()
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

    it("allows pressing change pin row", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation()

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

      expect(consoleSpy).toHaveBeenCalledWith("Change PIN pressed")
      consoleSpy.mockRestore()
    })

    it("allows pressing order physical card row", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation()

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

      expect(consoleSpy).toHaveBeenCalledWith("Order physical card pressed")
      consoleSpy.mockRestore()
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
      const consoleSpy = jest.spyOn(console, "log").mockImplementation()

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

      expect(consoleSpy).toHaveBeenCalledWith("Replace card pressed")
      consoleSpy.mockRestore()
    })

    it("allows pressing contact support row", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation()

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

      expect(consoleSpy).toHaveBeenCalledWith("Contact support pressed")
      consoleSpy.mockRestore()
    })

    it("allows pressing terms and conditions row", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation()

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

      expect(consoleSpy).toHaveBeenCalledWith("Terms and Conditions pressed")
      consoleSpy.mockRestore()
    })

    it("allows pressing privacy policy row", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation()

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

      expect(consoleSpy).toHaveBeenCalledWith("Privacy Policy pressed")
      consoleSpy.mockRestore()
    })

    it("allows pressing close card account row", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation()

      const { getByText } = render(
        <ContextForScreen>
          <CardSettingsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const row = getByText("Close card account")
      await act(async () => {
        fireEvent.press(row)
      })

      expect(consoleSpy).toHaveBeenCalledWith("Close card account pressed")
      consoleSpy.mockRestore()
    })
  })

  describe("switch interactions", () => {
    it("toggles transaction alerts switch", async () => {
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

      expect(getAllByRole("switch")[0].props.accessibilityState.checked).toBe(false)
    })

    it("toggles security alerts switch", async () => {
      const { getAllByRole } = render(
        <ContextForScreen>
          <CardSettingsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const switches = getAllByRole("switch")
      expect(switches[1].props.accessibilityState.checked).toBe(true)

      await act(async () => {
        fireEvent(switches[1], "pressIn")
      })

      expect(getAllByRole("switch")[1].props.accessibilityState.checked).toBe(false)
    })

    it("toggles marketing updates switch", async () => {
      const { getAllByRole } = render(
        <ContextForScreen>
          <CardSettingsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const switches = getAllByRole("switch")
      expect(switches[2].props.accessibilityState.checked).toBe(false)

      await act(async () => {
        fireEvent(switches[2], "pressIn")
      })

      expect(getAllByRole("switch")[2].props.accessibilityState.checked).toBe(true)
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
      const consoleSpy = jest.spyOn(console, "log").mockImplementation()

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
      expect(consoleSpy).toHaveBeenCalledWith("Order physical card pressed")
      expect(consoleSpy).toHaveBeenCalledWith("Contact support pressed")

      consoleSpy.mockRestore()
    })
  })
})
