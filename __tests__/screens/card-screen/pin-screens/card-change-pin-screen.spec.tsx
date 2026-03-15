import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { CardChangePinScreen } from "@app/screens/card-screen/pin-screens/card-change-pin-screen"
import { ContextForScreen } from "../../helper"

const mockNavigate = jest.fn()
const mockGoBack = jest.fn()
const mockAddListener = jest.fn()

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    addListener: mockAddListener,
  }),
}))

jest.mock("@app/utils/toast", () => ({
  toastShow: jest.fn(),
}))

const mockUseBiometricGate = jest.fn().mockReturnValue(true)
jest.mock("@app/screens/card-screen/hooks/use-biometric-gate", () => ({
  useBiometricGate: (...args: unknown[]) => mockUseBiometricGate(...args),
}))

const mockUpdatePin = jest.fn().mockResolvedValue(true)
jest.mock("@app/screens/card-screen/pin-screens/hooks/use-card-pin-update", () => ({
  useCardPinUpdate: () => ({ updatePin: mockUpdatePin, loading: false }),
}))

import { toastShow } from "@app/utils/toast"

describe("CardChangePinScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    mockNavigate.mockClear()
    mockGoBack.mockClear()
    mockAddListener.mockReturnValue(jest.fn())
    mockUseBiometricGate.mockReturnValue(true)
    mockUpdatePin.mockResolvedValue(true)
  })

  describe("biometric gate", () => {
    it("does not render when biometric not authenticated", async () => {
      mockUseBiometricGate.mockReturnValue(false)

      const { queryByText } = render(
        <ContextForScreen>
          <CardChangePinScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(queryByText("Enter new PIN")).toBeNull()
      expect(queryByText("New PIN")).toBeNull()
    })

    it("calls useBiometricGate with required true", async () => {
      render(
        <ContextForScreen>
          <CardChangePinScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(mockUseBiometricGate).toHaveBeenCalledWith(
        expect.objectContaining({ required: true }),
      )
    })
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

    it("displays enter new pin title on first step", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardChangePinScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Enter new PIN")).toBeTruthy()
    })

    it("displays enter new pin subtitle on first step", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardChangePinScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Please enter your new 4-digit PIN.")).toBeTruthy()
    })
  })

  describe("steps progress bar", () => {
    it("displays two steps", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardChangePinScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("New PIN")).toBeTruthy()
      expect(getByText("Confirm")).toBeTruthy()
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

  describe("new pin flow", () => {
    it("advances to confirm step after entering new PIN", async () => {
      const { getByTestId, getByText } = render(
        <ContextForScreen>
          <CardChangePinScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      fireEvent.press(getByTestId("NumericKey-5"))
      fireEvent.press(getByTestId("NumericKey-8"))
      fireEvent.press(getByTestId("NumericKey-2"))

      await act(async () => {
        fireEvent.press(getByTestId("NumericKey-9"))
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

      fireEvent.press(getByTestId("NumericKey-5"))
      fireEvent.press(getByTestId("NumericKey-8"))
      fireEvent.press(getByTestId("NumericKey-2"))

      await act(async () => {
        fireEvent.press(getByTestId("NumericKey-9"))
      })

      expect(getByText("Please re-enter your new 4-digit PIN to continue.")).toBeTruthy()
    })
  })

  describe("weak PIN validation", () => {
    it("shows weak PIN error on new PIN step", async () => {
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

      expect(
        getByText("This PIN is too easy to guess. Please choose a stronger PIN."),
      ).toBeTruthy()
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

      fireEvent.press(getByTestId("NumericKey-5"))
      fireEvent.press(getByTestId("NumericKey-8"))
      fireEvent.press(getByTestId("NumericKey-2"))

      await act(async () => {
        fireEvent.press(getByTestId("NumericKey-9"))
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

      fireEvent.press(getByTestId("NumericKey-5"))
      fireEvent.press(getByTestId("NumericKey-8"))
      fireEvent.press(getByTestId("NumericKey-2"))

      await act(async () => {
        fireEvent.press(getByTestId("NumericKey-9"))
      })

      fireEvent.press(getByTestId("NumericKey-5"))
      fireEvent.press(getByTestId("NumericKey-8"))
      fireEvent.press(getByTestId("NumericKey-2"))

      await act(async () => {
        fireEvent.press(getByTestId("NumericKey-9"))
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

      fireEvent.press(getByTestId("NumericKey-5"))
      fireEvent.press(getByTestId("NumericKey-8"))
      fireEvent.press(getByTestId("NumericKey-2"))

      await act(async () => {
        fireEvent.press(getByTestId("NumericKey-9"))
      })

      fireEvent.press(getByTestId("NumericKey-5"))
      fireEvent.press(getByTestId("NumericKey-8"))
      fireEvent.press(getByTestId("NumericKey-2"))

      await act(async () => {
        fireEvent.press(getByTestId("NumericKey-9"))
      })

      const confirmButtons = getAllByText("Confirm")
      await act(async () => {
        fireEvent.press(confirmButtons[confirmButtons.length - 1])
      })

      expect(mockUpdatePin).toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith("cardSettingsScreen")
    })

    it("does not navigate when mutation fails", async () => {
      mockUpdatePin.mockResolvedValue(false)

      const { getByTestId, getAllByText } = render(
        <ContextForScreen>
          <CardChangePinScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      fireEvent.press(getByTestId("NumericKey-5"))
      fireEvent.press(getByTestId("NumericKey-8"))
      fireEvent.press(getByTestId("NumericKey-2"))

      await act(async () => {
        fireEvent.press(getByTestId("NumericKey-9"))
      })

      fireEvent.press(getByTestId("NumericKey-5"))
      fireEvent.press(getByTestId("NumericKey-8"))
      fireEvent.press(getByTestId("NumericKey-2"))

      await act(async () => {
        fireEvent.press(getByTestId("NumericKey-9"))
      })

      const confirmButtons = getAllByText("Confirm")
      await act(async () => {
        fireEvent.press(confirmButtons[confirmButtons.length - 1])
      })

      expect(mockUpdatePin).toHaveBeenCalled()
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it("shows success toast when PIN is changed", async () => {
      const { getByTestId, getAllByText } = render(
        <ContextForScreen>
          <CardChangePinScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      fireEvent.press(getByTestId("NumericKey-5"))
      fireEvent.press(getByTestId("NumericKey-8"))
      fireEvent.press(getByTestId("NumericKey-2"))

      await act(async () => {
        fireEvent.press(getByTestId("NumericKey-9"))
      })

      fireEvent.press(getByTestId("NumericKey-5"))
      fireEvent.press(getByTestId("NumericKey-8"))
      fireEvent.press(getByTestId("NumericKey-2"))

      await act(async () => {
        fireEvent.press(getByTestId("NumericKey-9"))
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

      expect(getByText("Enter new PIN")).toBeTruthy()
      expect(getByText("New PIN")).toBeTruthy()

      fireEvent.press(getByTestId("NumericKey-7"))
      fireEvent.press(getByTestId("NumericKey-1"))
      fireEvent.press(getByTestId("NumericKey-9"))

      await act(async () => {
        fireEvent.press(getByTestId("NumericKey-3"))
      })

      expect(getByText("Confirm new PIN")).toBeTruthy()

      fireEvent.press(getByTestId("NumericKey-7"))
      fireEvent.press(getByTestId("NumericKey-1"))
      fireEvent.press(getByTestId("NumericKey-9"))

      await act(async () => {
        fireEvent.press(getByTestId("NumericKey-3"))
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
