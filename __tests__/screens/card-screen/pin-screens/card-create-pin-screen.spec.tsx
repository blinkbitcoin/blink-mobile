import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { CardCreatePinScreen } from "@app/screens/card-screen/pin-screens/card-create-pin-screen"
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

import { toastShow } from "@app/utils/toast"

describe("CardCreatePinScreen", () => {
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
          <CardCreatePinScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(toJSON()).toBeTruthy()
    })

    it("displays set pin title on first step", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardCreatePinScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Enter your PIN")).toBeTruthy()
    })

    it("displays set pin subtitle on first step", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardCreatePinScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Please enter a 4-digit PIN to continue.")).toBeTruthy()
    })
  })

  describe("steps progress bar", () => {
    it("displays two steps", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardCreatePinScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Set PIN")).toBeTruthy()
      expect(getByText("Confirm")).toBeTruthy()
    })
  })

  describe("keypad", () => {
    it("displays numeric keypad", async () => {
      const { getByTestId } = render(
        <ContextForScreen>
          <CardCreatePinScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByTestId("NumericKey-1")).toBeTruthy()
      expect(getByTestId("NumericKey-2")).toBeTruthy()
      expect(getByTestId("NumericKey-3")).toBeTruthy()
    })
  })

  describe("pin entry flow", () => {
    it("advances to confirm step after entering 4-digit PIN", async () => {
      const { getByTestId, getByText } = render(
        <ContextForScreen>
          <CardCreatePinScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      fireEvent.press(getByTestId("NumericKey-1"))
      fireEvent.press(getByTestId("NumericKey-2"))
      fireEvent.press(getByTestId("NumericKey-3"))

      await act(async () => {
        fireEvent.press(getByTestId("NumericKey-4"))
      })

      expect(getByText("Confirm new PIN")).toBeTruthy()
    })

    it("shows confirm subtitle after advancing to step 2", async () => {
      const { getByTestId, getByText } = render(
        <ContextForScreen>
          <CardCreatePinScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      fireEvent.press(getByTestId("NumericKey-1"))
      fireEvent.press(getByTestId("NumericKey-2"))
      fireEvent.press(getByTestId("NumericKey-3"))

      await act(async () => {
        fireEvent.press(getByTestId("NumericKey-4"))
      })

      expect(getByText("Please re-enter your new 4-digit PIN to continue.")).toBeTruthy()
    })

    it("shows error when PINs do not match", async () => {
      const { getByTestId, getByText } = render(
        <ContextForScreen>
          <CardCreatePinScreen />
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

      expect(
        getByText(
          "PINs do not match. Re-enter to confirm or go back to change your PIN.",
        ),
      ).toBeTruthy()
    })

    it("shows confirm button when PINs match", async () => {
      const { getByTestId, getAllByText } = render(
        <ContextForScreen>
          <CardCreatePinScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      fireEvent.press(getByTestId("NumericKey-1"))
      fireEvent.press(getByTestId("NumericKey-2"))
      fireEvent.press(getByTestId("NumericKey-3"))

      await act(async () => {
        fireEvent.press(getByTestId("NumericKey-4"))
      })

      fireEvent.press(getByTestId("NumericKey-1"))
      fireEvent.press(getByTestId("NumericKey-2"))
      fireEvent.press(getByTestId("NumericKey-3"))

      await act(async () => {
        fireEvent.press(getByTestId("NumericKey-4"))
      })

      const confirmElements = getAllByText("Confirm")
      expect(confirmElements.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe("completion flow", () => {
    it("navigates to card settings when confirm is pressed", async () => {
      const { getByTestId, getAllByText } = render(
        <ContextForScreen>
          <CardCreatePinScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      fireEvent.press(getByTestId("NumericKey-1"))
      fireEvent.press(getByTestId("NumericKey-2"))
      fireEvent.press(getByTestId("NumericKey-3"))

      await act(async () => {
        fireEvent.press(getByTestId("NumericKey-4"))
      })

      fireEvent.press(getByTestId("NumericKey-1"))
      fireEvent.press(getByTestId("NumericKey-2"))
      fireEvent.press(getByTestId("NumericKey-3"))

      await act(async () => {
        fireEvent.press(getByTestId("NumericKey-4"))
      })

      const confirmButtons = getAllByText("Confirm")
      await act(async () => {
        fireEvent.press(confirmButtons[confirmButtons.length - 1])
      })

      expect(mockNavigate).toHaveBeenCalledWith("cardSettingsScreen")
    })

    it("shows success toast when PIN is created", async () => {
      const { getByTestId, getAllByText } = render(
        <ContextForScreen>
          <CardCreatePinScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      fireEvent.press(getByTestId("NumericKey-1"))
      fireEvent.press(getByTestId("NumericKey-2"))
      fireEvent.press(getByTestId("NumericKey-3"))

      await act(async () => {
        fireEvent.press(getByTestId("NumericKey-4"))
      })

      fireEvent.press(getByTestId("NumericKey-1"))
      fireEvent.press(getByTestId("NumericKey-2"))
      fireEvent.press(getByTestId("NumericKey-3"))

      await act(async () => {
        fireEvent.press(getByTestId("NumericKey-4"))
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

  describe("error clearing", () => {
    it("clears error when user starts entering new PIN", async () => {
      const { getByTestId, getByText, queryByText } = render(
        <ContextForScreen>
          <CardCreatePinScreen />
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

      expect(
        getByText(
          "PINs do not match. Re-enter to confirm or go back to change your PIN.",
        ),
      ).toBeTruthy()

      await act(async () => {
        fireEvent.press(getByTestId("NumericKey-1"))
      })

      expect(
        queryByText(
          "PINs do not match. Re-enter to confirm or go back to change your PIN.",
        ),
      ).toBeNull()
    })
  })

  describe("complete user flow", () => {
    it("allows user to create PIN successfully", async () => {
      const { getByTestId, getByText, getAllByText } = render(
        <ContextForScreen>
          <CardCreatePinScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Enter your PIN")).toBeTruthy()
      expect(getByText("Set PIN")).toBeTruthy()

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
