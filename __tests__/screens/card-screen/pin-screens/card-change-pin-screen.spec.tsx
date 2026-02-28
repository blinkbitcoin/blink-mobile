import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { CardChangePinScreen } from "@app/screens/card-screen/pin-screens/card-change-pin-screen"
import { ContextForScreen } from "../../helper"

const mockNavigate = jest.fn()
const mockAddListener = jest.fn()

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    navigate: mockNavigate,
    addListener: mockAddListener,
  }),
}))

jest.mock("@app/utils/toast", () => ({
  toastShow: jest.fn(),
}))

jest.mock("@app/screens/card-screen/card-mock-data", () => ({
  MOCK_CARD_PIN: "1234",
}))

import { toastShow } from "@app/utils/toast"

describe("CardChangePinScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    mockNavigate.mockClear()
    mockAddListener.mockReturnValue(jest.fn())
  })

  describe("rendering", () => {
    it("renders without crashing", async () => {
      const { toJSON } = render(
        <ContextForScreen>
          <CardChangePinScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(toJSON()).toBeTruthy()
    })

    it("displays enter current pin title on first step", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardChangePinScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Enter current PIN")).toBeTruthy()
    })

    it("displays enter current pin subtitle on first step", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardChangePinScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Please enter your current 4-digit PIN to continue.")).toBeTruthy()
    })
  })

  describe("steps progress bar", () => {
    it("displays three steps", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardChangePinScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Current PIN")).toBeTruthy()
      expect(getByText("New PIN")).toBeTruthy()
    })
  })

  describe("keypad", () => {
    it("displays numeric keypad", async () => {
      const { getByTestId } = render(
        <ContextForScreen>
          <CardChangePinScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByTestId("NumericKey-1")).toBeTruthy()
      expect(getByTestId("NumericKey-2")).toBeTruthy()
      expect(getByTestId("NumericKey-3")).toBeTruthy()
    })
  })

  describe("current pin verification", () => {
    it("shows error when current PIN is incorrect", async () => {
      const { getByTestId, getByText } = render(
        <ContextForScreen>
          <CardChangePinScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      fireEvent.press(getByTestId("NumericKey-5"))
      fireEvent.press(getByTestId("NumericKey-6"))
      fireEvent.press(getByTestId("NumericKey-7"))

      await act(async () => {
        fireEvent.press(getByTestId("NumericKey-8"))
      })

      expect(getByText("Incorrect PIN. Please try again.")).toBeTruthy()
    })

    it("advances to new pin step when current PIN is correct", async () => {
      const { getByTestId, getByText } = render(
        <ContextForScreen>
          <CardChangePinScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      fireEvent.press(getByTestId("NumericKey-1"))
      fireEvent.press(getByTestId("NumericKey-2"))
      fireEvent.press(getByTestId("NumericKey-3"))

      await act(async () => {
        fireEvent.press(getByTestId("NumericKey-4"))
      })

      expect(getByText("Enter new PIN")).toBeTruthy()
    })

    it("shows new pin subtitle after entering correct current PIN", async () => {
      const { getByTestId, getByText } = render(
        <ContextForScreen>
          <CardChangePinScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      fireEvent.press(getByTestId("NumericKey-1"))
      fireEvent.press(getByTestId("NumericKey-2"))
      fireEvent.press(getByTestId("NumericKey-3"))

      await act(async () => {
        fireEvent.press(getByTestId("NumericKey-4"))
      })

      expect(getByText("Please enter your new 4-digit PIN.")).toBeTruthy()
    })
  })

  describe("new pin flow", () => {
    it("advances to confirm step after entering new PIN", async () => {
      const { getByTestId, getByText } = render(
        <ContextForScreen>
          <CardChangePinScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      fireEvent.press(getByTestId("NumericKey-1"))
      fireEvent.press(getByTestId("NumericKey-2"))
      fireEvent.press(getByTestId("NumericKey-3"))

      await act(async () => {
        fireEvent.press(getByTestId("NumericKey-4"))
      })

      fireEvent.press(getByTestId("NumericKey-5"))
      fireEvent.press(getByTestId("NumericKey-6"))
      fireEvent.press(getByTestId("NumericKey-7"))

      await act(async () => {
        fireEvent.press(getByTestId("NumericKey-8"))
      })

      expect(getByText("Confirm new PIN")).toBeTruthy()
    })

    it("shows confirm subtitle after entering new PIN", async () => {
      const { getByTestId, getByText } = render(
        <ContextForScreen>
          <CardChangePinScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      fireEvent.press(getByTestId("NumericKey-1"))
      fireEvent.press(getByTestId("NumericKey-2"))
      fireEvent.press(getByTestId("NumericKey-3"))

      await act(async () => {
        fireEvent.press(getByTestId("NumericKey-4"))
      })

      fireEvent.press(getByTestId("NumericKey-5"))
      fireEvent.press(getByTestId("NumericKey-6"))
      fireEvent.press(getByTestId("NumericKey-7"))

      await act(async () => {
        fireEvent.press(getByTestId("NumericKey-8"))
      })

      expect(getByText("Please re-enter your new 4-digit PIN to continue.")).toBeTruthy()
    })
  })

  describe("pin confirmation", () => {
    it("shows error when PINs do not match", async () => {
      const { getByTestId, getByText } = render(
        <ContextForScreen>
          <CardChangePinScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      fireEvent.press(getByTestId("NumericKey-1"))
      fireEvent.press(getByTestId("NumericKey-2"))
      fireEvent.press(getByTestId("NumericKey-3"))

      await act(async () => {
        fireEvent.press(getByTestId("NumericKey-4"))
      })

      fireEvent.press(getByTestId("NumericKey-5"))
      fireEvent.press(getByTestId("NumericKey-6"))
      fireEvent.press(getByTestId("NumericKey-7"))

      await act(async () => {
        fireEvent.press(getByTestId("NumericKey-8"))
      })

      fireEvent.press(getByTestId("NumericKey-9"))
      fireEvent.press(getByTestId("NumericKey-0"))
      fireEvent.press(getByTestId("NumericKey-1"))

      await act(async () => {
        fireEvent.press(getByTestId("NumericKey-2"))
      })

      expect(
        getByText(
          "PINs do not match. Re-enter to confirm or go back to change your PIN.",
        ),
      ).toBeTruthy()
    })

    it("shows confirm button when PINs match", async () => {
      const { getByTestId, getAllByText } = render(
        <ContextForScreen>
          <CardChangePinScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      fireEvent.press(getByTestId("NumericKey-1"))
      fireEvent.press(getByTestId("NumericKey-2"))
      fireEvent.press(getByTestId("NumericKey-3"))

      await act(async () => {
        fireEvent.press(getByTestId("NumericKey-4"))
      })

      fireEvent.press(getByTestId("NumericKey-5"))
      fireEvent.press(getByTestId("NumericKey-6"))
      fireEvent.press(getByTestId("NumericKey-7"))

      await act(async () => {
        fireEvent.press(getByTestId("NumericKey-8"))
      })

      fireEvent.press(getByTestId("NumericKey-5"))
      fireEvent.press(getByTestId("NumericKey-6"))
      fireEvent.press(getByTestId("NumericKey-7"))

      await act(async () => {
        fireEvent.press(getByTestId("NumericKey-8"))
      })

      const confirmElements = getAllByText("Confirm")
      expect(confirmElements.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe("completion flow", () => {
    it("navigates to card settings when confirm is pressed", async () => {
      const { getByTestId, getAllByText } = render(
        <ContextForScreen>
          <CardChangePinScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      fireEvent.press(getByTestId("NumericKey-1"))
      fireEvent.press(getByTestId("NumericKey-2"))
      fireEvent.press(getByTestId("NumericKey-3"))

      await act(async () => {
        fireEvent.press(getByTestId("NumericKey-4"))
      })

      fireEvent.press(getByTestId("NumericKey-5"))
      fireEvent.press(getByTestId("NumericKey-6"))
      fireEvent.press(getByTestId("NumericKey-7"))

      await act(async () => {
        fireEvent.press(getByTestId("NumericKey-8"))
      })

      fireEvent.press(getByTestId("NumericKey-5"))
      fireEvent.press(getByTestId("NumericKey-6"))
      fireEvent.press(getByTestId("NumericKey-7"))

      await act(async () => {
        fireEvent.press(getByTestId("NumericKey-8"))
      })

      const confirmButtons = getAllByText("Confirm")
      await act(async () => {
        fireEvent.press(confirmButtons[confirmButtons.length - 1])
      })

      expect(mockNavigate).toHaveBeenCalledWith("cardSettingsScreen")
    })

    it("shows success toast when PIN is changed", async () => {
      const { getByTestId, getAllByText } = render(
        <ContextForScreen>
          <CardChangePinScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      fireEvent.press(getByTestId("NumericKey-1"))
      fireEvent.press(getByTestId("NumericKey-2"))
      fireEvent.press(getByTestId("NumericKey-3"))

      await act(async () => {
        fireEvent.press(getByTestId("NumericKey-4"))
      })

      fireEvent.press(getByTestId("NumericKey-5"))
      fireEvent.press(getByTestId("NumericKey-6"))
      fireEvent.press(getByTestId("NumericKey-7"))

      await act(async () => {
        fireEvent.press(getByTestId("NumericKey-8"))
      })

      fireEvent.press(getByTestId("NumericKey-5"))
      fireEvent.press(getByTestId("NumericKey-6"))
      fireEvent.press(getByTestId("NumericKey-7"))

      await act(async () => {
        fireEvent.press(getByTestId("NumericKey-8"))
      })

      const confirmButtons = getAllByText("Confirm")
      await act(async () => {
        fireEvent.press(confirmButtons[confirmButtons.length - 1])
      })

      expect(toastShow).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "success",
        }),
      )
    })
  })

  describe("complete user flow", () => {
    it("allows user to change PIN successfully", async () => {
      const { getByTestId, getByText, getAllByText } = render(
        <ContextForScreen>
          <CardChangePinScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Enter current PIN")).toBeTruthy()
      expect(getByText("Current PIN")).toBeTruthy()
      expect(getByText("New PIN")).toBeTruthy()

      fireEvent.press(getByTestId("NumericKey-1"))
      fireEvent.press(getByTestId("NumericKey-2"))
      fireEvent.press(getByTestId("NumericKey-3"))

      await act(async () => {
        fireEvent.press(getByTestId("NumericKey-4"))
      })

      expect(getByText("Enter new PIN")).toBeTruthy()

      fireEvent.press(getByTestId("NumericKey-9"))
      fireEvent.press(getByTestId("NumericKey-8"))
      fireEvent.press(getByTestId("NumericKey-7"))

      await act(async () => {
        fireEvent.press(getByTestId("NumericKey-6"))
      })

      expect(getByText("Confirm new PIN")).toBeTruthy()

      fireEvent.press(getByTestId("NumericKey-9"))
      fireEvent.press(getByTestId("NumericKey-8"))
      fireEvent.press(getByTestId("NumericKey-7"))

      await act(async () => {
        fireEvent.press(getByTestId("NumericKey-6"))
      })

      const confirmButtons = getAllByText("Confirm")
      await act(async () => {
        fireEvent.press(confirmButtons[confirmButtons.length - 1])
      })

      expect(mockNavigate).toHaveBeenCalledWith("cardSettingsScreen")
      expect(toastShow).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "success",
        }),
      )
    })
  })
})
